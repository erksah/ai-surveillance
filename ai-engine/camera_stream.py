import cv2
import time
import threading

class CameraStream:
  def __init__(self, camera_id, source_url, detector):
    self.camera_id = camera_id
    # Parse source url: if it's a digit, treat it as USB camera index
    if source_url.isdigit():
      self.source = int(source_url)
    else:
      self.source = source_url
      
    self.detector = detector
    
    self.cap = None
    self.latest_frame = None
    self.is_running = False
    self.is_connected = False
    
    # Thread handle
    self.thread = None
    
    # Lock for thread-safe access to latest_frame
    self.lock = threading.Lock()
    
    # Metrics
    self.fps = 0.0
    self.frame_count = 0
    self.last_fps_time = time.time()

  def start(self):
    if not self.is_running:
      self.is_running = True
      self.thread = threading.Thread(target=self._run, name=f"CamThread-{self.camera_id}")
      self.thread.daemon = True
      self.thread.start()
      print(f"Camera stream thread started for camera {self.camera_id} (Source: {self.source})")

  def stop(self):
    self.is_running = False
    if self.thread:
      self.thread.join(timeout=3)
    if self.cap:
      self.cap.release()
    self.is_connected = False
    print(f"Camera stream thread stopped for camera {self.camera_id}")

  def open_cap_with_timeout(self, timeout=6.0):
    cap_holder = [None]
    def target():
      try:
        cap_holder[0] = cv2.VideoCapture(self.source)
      except Exception as e:
        print(f"VideoCapture exception: {e}")
    
    t = threading.Thread(target=target)
    t.daemon = True
    t.start()
    t.join(timeout)
    if t.is_alive():
      print("WARNING: Opening camera device timed out (dangling driver or blocked device). Using simulation!")
      return None
    return cap_holder[0]

  def _run(self):
    import numpy as np
    retry_interval = 5 # seconds
    self.use_simulation = False
    
    # Bouncing circle variables for simulation
    sim_px = 640
    sim_py = 360
    sim_dx = 12
    sim_dy = 8

    while self.is_running:
      if not self.use_simulation and (self.cap is None or not self.cap.isOpened()):
        print(f"Connecting to camera {self.camera_id} source: {self.source}...")
        self.is_connected = False
        
        self.cap = self.open_cap_with_timeout()
          
        if self.cap is None or not self.cap.isOpened():
          print(f"Failed to connect to camera {self.source}. Activating Simulated Video Feed.")
          self.use_simulation = True
          self.is_connected = True
        else:
          print(f"Connected to camera source {self.source} successfully")
          self.is_connected = True
          try:
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            self.cap.set(cv2.CAP_PROP_FPS, 15)
          except Exception as e:
            print(f"Warning setting resolution: {e}")

      while self.is_running and (self.use_simulation or (self.cap and self.cap.isOpened())):
        if self.use_simulation:
          # Generate simulated CCTV visual frame
          frame = np.zeros((720, 1280, 3), dtype=np.uint8)
          
          # Draw grid layout
          for x in range(0, 1280, 80):
            cv2.line(frame, (x, 0), (x, 720), (25, 25, 25), 1)
          for y in range(0, 720, 80):
            cv2.line(frame, (0, y), (1280, y), (25, 25, 25), 1)
            
          # Text headers
          cv2.putText(frame, "SENTINEL ACTIVE MONITORING", (50, 70), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
          cv2.putText(frame, f"FEED ID: {self.camera_id[:8]}... | SOURCE: {self.source}", (50, 105), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (140, 140, 140), 2)
          cv2.putText(frame, "AI ENGINE RUNNING (SIMULATION FALLBACK)", (50, 140), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (34, 197, 94), 1)
          
          # Bouncing box math
          sim_px += sim_dx
          sim_py += sim_dy
          if sim_px - 80 < 50 or sim_px + 80 > 1230:
            sim_dx = -sim_dx
          if sim_py - 120 < 180 or sim_py + 120 > 670:
            sim_dy = -sim_dy
            
          # Draw a white target inside the canvas to simulate motion differencing
          cv2.circle(frame, (sim_px, sim_py), 45, (180, 180, 180), -1)
          
        else:
          ret, frame = self.cap.read()
          if not ret:
            print(f"Connection lost for camera {self.camera_id} source {self.source}. Retrying...")
            self.is_connected = False
            if self.cap:
              self.cap.release()
            break
        
        # Calculate FPS metrics
        self.frame_count += 1
        curr_time = time.time()
        elapsed = curr_time - self.last_fps_time
        if elapsed >= 2.0:
          self.fps = self.frame_count / elapsed
          self.frame_count = 0
          self.last_fps_time = curr_time

        # Process the frame with AI (motion, yolo, fall, etc.)
        try:
          processed_frame = self.detector.process_frame(self.camera_id, frame)
        except Exception as e:
          print(f"AI processing error on camera {self.camera_id}: {e}")
          processed_frame = frame

        # Add FPS overlay text
        cv2.putText(processed_frame, f"FPS: {self.fps:.1f}", (10, processed_frame.shape[0] - 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (34, 197, 94), 2)

        with self.lock:
          self.latest_frame = processed_frame

        # Throttle loop to maintain reasonable FPS
        time.sleep(0.06)

  def get_frame_bytes(self):
    """
    Encodes the latest frame as JPEG bytes.
    Returns: byte array of JPEG, or None if no frame is available.
    """
    with self.lock:
      if self.latest_frame is None:
        return None
      # Make a copy to avoid modification during encoding
      frame_copy = self.latest_frame.copy()
      
    ret, jpeg = cv2.imencode('.jpg', frame_copy)
    if not ret:
      return None
    return jpeg.tobytes()
