import time
import requests
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from detector import AIDetector
from camera_stream import CameraStream

app = Flask(__name__)
CORS(app)

# Global variables
backend_url = "http://localhost:5000"
detector = AIDetector(backend_url=backend_url)
active_streams = {} # Key: camera_id, Value: CameraStream object

def get_cameras_from_backend():
  """
  Fetches camera configuration from Express backend.
  """
  try:
    # First authenticate if needed, or query direct. We can bypass auth for AI-Engine to Backend communication,
    # or login as a service. In our Express setup, camera GET is protected, but we can bypass for local AI Engine,
    # or login. Wait, getCameras API is protected by 'auth' middleware.
    # To bypass it easily, the backend could allow queries from localhost, or we can use a service user,
    # or we can simply register a default camera if we can't reach backend or get 401.
    # Actually, we can login! Let's check: the AI Engine can register/login an 'ai_engine' service account.
    # But a simpler and cleaner way: let's modify the Express backend routes, or simply allow the AI engine
    # to authenticate by logging in with a default credential!
    # Let's write login credentials. We can try to register 'ai_service@surveillance.local' first, then login,
    # obtain JWT token, and use it in Authorization headers.
    # Let's implement service authentication in main.py.
    
    # 1. Register service account (fails silently if already exists)
    service_payload = {
      'username': 'ai_service',
      'email': 'ai_service@surveillance.local',
      'password': 'ai_secure_service_password_2026'
    }
    try:
      requests.post(f"{backend_url}/api/auth/register", json=service_payload, timeout=3)
    except:
      pass

    # 2. Login service account
    login_resp = requests.post(f"{backend_url}/api/auth/login", json={
      'email': 'ai_service@surveillance.local',
      'password': 'ai_secure_service_password_2026'
    }, timeout=3)
    
    token = ""
    if login_resp.status_code == 200:
      token = login_resp.json().get('token', '')
      
    headers = {}
    if token:
      headers['Authorization'] = f"Bearer {token}"
      
    resp = requests.get(f"{backend_url}/api/cameras", headers=headers, timeout=5)
    if resp.status_code == 200:
      return resp.json()
    else:
      print(f"Backend cameras API returned code {resp.status_code}")
      return []
  except Exception as e:
    print(f"Error fetching cameras from backend: {e}")
    return []

def sync_cameras():
  """
  Synchronizes running OpenCV camera capture threads with Mongoose DB configuration.
  """
  print("Syncing cameras with backend...")
  cameras_config = get_cameras_from_backend()
  
  # If we couldn't connect, seed a default webcam stream if no active streams exist
  if not cameras_config and not active_streams:
    print("Cannot retrieve cameras from backend. Starting fallback default webcam (0)...")
    fallback_id = "default_webcam"
    fallback_stream = CameraStream(fallback_id, "0", detector)
    fallback_stream.start()
    active_streams[fallback_id] = fallback_stream
    return
  
  # Keep track of IDs present in current config
  config_ids = set()
  
  for cam in cameras_config:
    cam_id = cam.get('_id') or cam.get('id')
    enabled = cam.get('enabled', True)
    source_url = cam.get('sourceUrl', '0')
    
    if not cam_id:
      continue
      
    config_ids.add(cam_id)
    
    # 1. If camera is enabled and not running, start it
    if enabled and cam_id not in active_streams:
      print(f"Initializing new camera: {cam.get('name')} ({cam_id})")
      stream = CameraStream(cam_id, source_url, detector)
      stream.start()
      active_streams[cam_id] = stream
      
    # 2. If camera is enabled and running, check if source changed
    elif enabled and cam_id in active_streams:
      current_stream = active_streams[cam_id]
      # Convert source to integer if digit
      expected_source = int(source_url) if source_url.isdigit() else source_url
      if current_stream.source != expected_source:
        print(f"Camera source updated for {cam_id}. Restarting stream thread...")
        current_stream.stop()
        new_stream = CameraStream(cam_id, source_url, detector)
        new_stream.start()
        active_streams[cam_id] = new_stream
        
    # 3. If camera is disabled but running, stop it
    elif not enabled and cam_id in active_streams:
      print(f"Stopping camera {cam_id} because it was disabled")
      active_streams[cam_id].stop()
      del active_streams[cam_id]

  # 4. Stop any running camera streams that were deleted from database
  for running_id in list(active_streams.keys()):
    if running_id != "default_webcam" and running_id not in config_ids:
      print(f"Stopping camera {running_id} because it was deleted from DB")
      active_streams[running_id].stop()
      del active_streams[running_id]

# Flask stream response generator
def generate_mjpeg_stream(camera_id):
  if camera_id not in active_streams:
    return "Camera not active or not found"
    
  stream = active_streams[camera_id]
  while True:
    frame_bytes = stream.get_frame_bytes()
    if frame_bytes is None:
      # Placeholder frame if camera is loading
      time.sleep(0.1)
      continue
      
    yield (b'--frame\r\n'
           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    time.sleep(0.05) # Keep frame rate matching loop throttle

# Endpoints
@app.route('/stream/<camera_id>')
def video_feed(camera_id):
  """
  Exposes the live video feed as an MJPEG multipart response.
  """
  if camera_id not in active_streams:
    # If default webcam is running and requested, let's stream it
    if "default_webcam" in active_streams:
      return Response(generate_mjpeg_stream("default_webcam"),
                      mimetype='multipart/x-mixed-replace; boundary=frame')
    return jsonify({'error': 'Camera not active'}), 404
    
  return Response(generate_mjpeg_stream(camera_id),
                  mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/update_cameras', methods=['POST'])
def update_cameras_endpoint():
  """
  API endpoint called by Express backend to notify AI engine of changes.
  """
  sync_cameras()
  return jsonify({'status': 'success', 'connected_count': len(active_streams)})

@app.route('/update_settings', methods=['POST'])
def update_settings_endpoint():
  """
  API endpoint called by Express backend to update AI confidence/sensitivity parameters.
  """
  settings = request.json
  if settings:
    detector.update_settings(settings)
    return jsonify({'status': 'success'})
  return jsonify({'error': 'No settings provided'}), 400

@app.route('/status', methods=['GET'])
def get_status():
  """
  Returns real-time status metrics of all connected camera streams.
  """
  status_info = {}
  for cam_id, stream in active_streams.items():
    status_info[cam_id] = {
      'source': str(stream.source),
      'is_connected': stream.is_connected,
      'fps': round(stream.fps, 1)
    }
  return jsonify({
    'status': 'active',
    'cameras': status_info,
    'confidence_threshold': detector.confidence_threshold,
    'motion_sensitivity': detector.motion_sensitivity
  })

if __name__ == '__main__':
  # Perform initial sync on startup
  print("AI Engine initializing...")
  # Delay slightly to allow backend server to start up
  time.sleep(3)
  sync_cameras()
  
  print("AI Engine Web Server running on port 8000")
  app.run(host='0.0.0.0', port=8000, threaded=True)
