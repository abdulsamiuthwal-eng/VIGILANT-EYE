import os
import cv2
import logging
import threading
from pathlib import Path
from config import TRAINING_CONFIG

logger = logging.getLogger(__name__)
_socketio = None

def set_extractor_socketio(sio):
    global _socketio
    _socketio = sio

def _emit_extraction_progress(data):
    if _socketio:
        _socketio.emit("extraction_progress", data)

class VideoExtractor:
    def __init__(self):
        self.dataset_path = Path(TRAINING_CONFIG["dataset_path"])
        self.raw_output_dir = self.dataset_path / "images" / "raw_videos"
        
    def start_extraction(self, video_path, fps_rate, original_filename):
        thread = threading.Thread(
            target=self._run_extraction,
            args=(video_path, fps_rate, original_filename),
            daemon=True
        )
        thread.start()
        return True, "Extraction started."

    def _run_extraction(self, video_path, fps_rate, original_filename):
        global _socketio
        try:
            self.raw_output_dir.mkdir(parents=True, exist_ok=True)
            
            _emit_extraction_progress({
                "status": "running",
                "progress": 0,
                "message": f"Initializing extraction for {original_filename}..."
            })
            
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                raise Exception("Could not open video file.")
            
            video_fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            if video_fps == 0 or total_frames == 0:
                raise Exception("Invalid video data.")
            
            # Prevent extracting more frames per second than the actual video has
            target_fps = min(fps_rate, int(video_fps)) if video_fps > 0 else fps_rate
            frame_interval = int(video_fps / target_fps) if target_fps > 0 else 1
            if frame_interval < 1:
                frame_interval = 1
                
            base_name = os.path.splitext(original_filename)[0].replace(" ", "_")
            current_frame = 0
            extracted_count = 0
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                    
                if current_frame % frame_interval == 0:
                    extracted_count += 1
                    # Save frame
                    file_name = f"{base_name}_frame_{extracted_count:04d}.jpg"
                    save_path = self.raw_output_dir / file_name
                    cv2.imwrite(str(save_path), frame)
                    
                current_frame += 1
                
                # Update progress every 10 frames
                if current_frame % 10 == 0:
                    prog = int((current_frame / total_frames) * 100)
                    _emit_extraction_progress({
                        "status": "running",
                        "progress": prog,
                        "message": f"Extracting: {prog}%"
                    })
                    
            cap.release()
            
            _emit_extraction_progress({
                "status": "completed",
                "progress": 100,
                "message": f"Successfully extracted {extracted_count} frames! Validate dataset to integrate."
            })
            
        except Exception as e:
            logger.error(f"Video extraction failed: {e}")
            _emit_extraction_progress({
                "status": "failed",
                "progress": 0,
                "message": f"Extraction failed: {str(e)}"
            })
        finally:
            # Clean up the temp uploaded file safely
            try:
                if os.path.exists(video_path):
                    os.remove(video_path)
            except Exception as e:
                logger.error(f"Failed to delete temp video file {video_path}: {e}")

# Global singleton
extractor = VideoExtractor()
