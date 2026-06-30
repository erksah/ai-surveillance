import cv2
import time
import os
import requests
import numpy as np
try:
  from ultralytics import YOLO
  YOLO_AVAILABLE = True
except ImportError:
  YOLO_AVAILABLE = False

class AIDetector:
  def __init__(self, backend_url="http://localhost:5000"):
    self.backend_url = backend_url
    if YOLO_AVAILABLE:
      print("Loading YOLOv8 model...")
      # This will load or download the nano YOLOv8 model
      self.yolo = YOLO('yolov8n.pt')
    else:
      print("WARNING: ultralytics (YOLOv8) not installed. Running in Mock/Motion-only Mode!")
      self.yolo = None
    
    # Store previous frame for motion detection per camera
    # Key: camera_id, Value: gray_frame
    self.prev_frames = {}
    
    # Cooldown to avoid flooding backend (30 seconds cooldown per type per camera)
    # Key: (camera_id, detection_type), Value: last_alert_time
    self.alert_cooldowns = {}
    self.cooldown_duration = 30.0 # seconds

    # Detection configurations (can be updated dynamically)
    self.confidence_threshold = 0.4
    self.motion_sensitivity = 800 # min contour area

  def update_settings(self, settings):
    self.confidence_threshold = settings.get('confidenceThreshold', self.confidence_threshold)
    self.motion_sensitivity = settings.get('motionSensitivity', self.motion_sensitivity)
    print(f"Detector settings updated. Confidence: {self.confidence_threshold}, Motion Area: {self.motion_sensitivity}")

  def detect_motion(self, camera_id, frame):
    """
    OpenCV frame-difference motion detection.
    Returns: True if motion is detected, and the processed frame with drawn contours.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (21, 21), 0)
    
    if camera_id not in self.prev_frames:
      self.prev_frames[camera_id] = gray
      return False, frame

    # Calculate absolute difference
    frame_delta = cv2.absdiff(self.prev_frames[camera_id], gray)
    thresh = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)[1]
    thresh = cv2.dilate(thresh, None, iterations=2)
    
    contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    motion_detected = False
    
    annotated_frame = frame.copy()
    for contour in contours:
      if cv2.contourArea(contour) < self.motion_sensitivity:
        continue
      
      motion_detected = True
      # Draw bounding box for motion
      (x, y, w, h) = cv2.boundingRect(contour)
      cv2.rectangle(annotated_frame, (x, y), (x + w, y + h), (0, 255, 255), 2) # Yellow for motion

    # Update previous frame
    self.prev_frames[camera_id] = gray
    return motion_detected, annotated_frame

  def detect_fire_smoke_placeholder(self, frame):
    """
    Basic color heuristic placeholder for fire detection.
    Looks for red/orange pixels in HSV space.
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    # Define orange/red fire colors range in HSV
    lower_fire = np.array([15, 100, 100])
    upper_fire = np.array([25, 255, 255])
    mask = cv2.inRange(hsv, lower_fire, upper_fire)
    fire_pixels = cv2.countNonZero(mask)
    
    # If a significant number of pixels are fire-colored, flag a warning placeholder
    height, width, _ = frame.shape
    total_pixels = height * width
    fire_ratio = fire_pixels / total_pixels
    
    # Extremely basic heuristic: if > 1% is orange/red, trigger a warning placeholder
    if fire_ratio > 0.01:
      return True, float(fire_ratio * 10) # Mock confidence score
    return False, 0.0

  def process_frame(self, camera_id, frame):
    """
    Applies Motion, YOLO object, Fall, and Fire/Smoke detection on a frame.
    Returns: Processed frame with visual overlays, and a list of detections.
    """
    detections_found = []
    annotated_frame = frame.copy()
    
    # 1. Motion Detection
    motion_detected, annotated_frame = self.detect_motion(camera_id, annotated_frame)
    if motion_detected:
      detections_found.append({
        'type': 'motion',
        'confidence': 1.0,
        'label': 'Motion Detected'
      })

    # 2. YOLO object detection (run on every frame or throttled, here we run it continuously)
    if YOLO_AVAILABLE and self.yolo is not None:
      results = self.yolo(frame, verbose=False)[0]
      
      for box in results.boxes:
        conf = float(box.conf[0])
        if conf < self.confidence_threshold:
          continue
        
        cls = int(box.cls[0])
        label = self.yolo.names[cls]
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        
        # Draw green box for general objects
        color = (0, 255, 0)
        
        # Look for persons (YOLO class 0)
        if label == 'person':
          # Fall Detection Heuristic: aspect ratio (w/h) > 1.2 (lying down)
          w = x2 - x1
          h = y2 - y1
          aspect_ratio = float(w) / h if h > 0 else 0
          
          if aspect_ratio > 1.2:
            # High probability of fall
            color = (0, 0, 255) # Red for fall alert
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 3)
            cv2.putText(annotated_frame, f"FALL ALERT! {conf:.2f}", (x1, y1 - 10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
            
            detections_found.append({
              'type': 'fall',
              'confidence': conf,
              'label': 'Fall Detected'
            })
          else:
            # Normal Person
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(annotated_frame, f"Person {conf:.2f}", (x1, y1 - 10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            detections_found.append({
              'type': 'person',
              'confidence': conf,
              'label': 'Person Detected'
            })
        else:
          # Other object detections (car, bag, etc.)
          cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
          cv2.putText(annotated_frame, f"{label} {conf:.2f}", (x1, y1 - 10), 
                      cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
          detections_found.append({
            'type': 'object',
            'confidence': conf,
            'label': f"{label.capitalize()} Detected"
          })
    else:
      # Mock Detection Mode: simulate random person/fall when motion is active
      if motion_detected:
        rand = np.random.rand()
        if rand > 0.90:
          detections_found.append({
            'type': 'person',
            'confidence': 0.88,
            'label': 'Person Detected (Mock)'
          })
          h, w, _ = annotated_frame.shape
          cv2.rectangle(annotated_frame, (int(w*0.35), int(h*0.2)), (int(w*0.65), int(h*0.85)), (0, 255, 0), 2)
          cv2.putText(annotated_frame, "Person 0.88 (Mock)", (int(w*0.35), int(h*0.2) - 10), 
                      cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        elif rand > 0.85:
          detections_found.append({
            'type': 'fall',
            'confidence': 0.94,
            'label': 'Fall Detected (Mock)'
          })
          h, w, _ = annotated_frame.shape
          cv2.rectangle(annotated_frame, (int(w*0.2), int(h*0.65)), (int(w*0.8), int(h*0.9)), (0, 0, 255), 3)
          cv2.putText(annotated_frame, "FALL ALERT! 0.94 (Mock)", (int(w*0.2), int(h*0.65) - 10), 
                      cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

    # 3. Fire/Smoke detection (placeholder heuristic)
    fire_detected, fire_conf = self.detect_fire_smoke_placeholder(frame)
    if fire_detected:
      # Draw indicator on top screen
      cv2.putText(annotated_frame, "FIRE WARNING PLACEHOLDER", (10, 30), 
                  cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
      detections_found.append({
        'type': 'fire',
        'confidence': min(fire_conf, 1.0),
        'label': 'Fire/Smoke Detected'
      })

    # Send alerts to backend if cooldown is satisfied
    current_time = time.time()
    for det in detections_found:
      det_type = det['type']
      cooldown_key = (camera_id, det_type)
      
      last_time = self.alert_cooldowns.get(cooldown_key, 0)
      if current_time - last_time >= self.cooldown_duration:
        self.alert_cooldowns[cooldown_key] = current_time
        # Trigger sending alert to backend in background/separate process
        self.send_alert_to_backend(camera_id, det_type, det['confidence'], annotated_frame)
        
    return annotated_frame

  def send_alert_to_backend(self, camera_id, detection_type, confidence, frame):
    """
    Saves snapshot locally and posts it to the Express backend.
    """
    try:
      # Save snapshot to temp file
      temp_filename = f"temp_{camera_id}_{detection_type}.jpg"
      cv2.imwrite(temp_filename, frame)
      
      url = f"{self.backend_url}/detections"
      
      from datetime import datetime, timezone
      data = {
        'cameraId': camera_id,
        'detectionType': detection_type,
        'confidence': str(confidence),
        'timestamp': datetime.now(timezone.utc).isoformat()
      }
      
      with open(temp_filename, 'rb') as f:
        files = {'image': (temp_filename, f, 'image/jpeg')}
        response = requests.post(url, data=data, files=files, timeout=5)
        
      # Cleanup temp file
      if os.path.exists(temp_filename):
        os.remove(temp_filename)
        
      if response.status_code == 201:
        print(f"[{detection_type}] Alert successfully sent to backend for camera {camera_id}")
      else:
        print(f"Failed to send alert. Status code: {response.status_code}, Response: {response.text}")
        
    except Exception as e:
      print(f"Error sending alert to backend: {e}")
