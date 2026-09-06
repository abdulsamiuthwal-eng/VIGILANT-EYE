"""
Vigilant Eye - Training Module
================================
YOLOv8 local training interface with progress tracking.
"""

import os
import logging
import threading
from datetime import datetime
from pathlib import Path
from config import TRAINING_CONFIG

logger = logging.getLogger(__name__)

# Global training state
_training_status = {
    "running": False,
    "progress": 0,
    "epoch": 0,
    "total_epochs": 0,
    "status": "idle",
    "message": "No training in progress",
    "results": None,
    "error": None,
    "start_time": None,
}
_socketio = None


def set_socketio(sio):
    global _socketio
    _socketio = sio


def _emit_progress(data):
    if _socketio:
        _socketio.emit("training_progress", data)


class ModelTrainer:
    """YOLOv8 training manager with dataset validation and progress reporting."""

    def __init__(self):
        self.dataset_path = Path(TRAINING_CONFIG["dataset_path"])
        self.output_dir = Path(TRAINING_CONFIG["output_dir"])
        self.config = TRAINING_CONFIG
        self.stop_requested = False
        self.last_loss_str = ""

    def validate_dataset(self):
        """Check dataset structure (YOLO format: images/ + labels/)."""
        images_dir = self.dataset_path / "images" / "train"
        labels_dir = self.dataset_path / "labels" / "train"
        data_yaml = self.dataset_path / "data.yaml"

        issues = []
        if not images_dir.exists():
            issues.append(f"Missing: {images_dir}")
        if not labels_dir.exists():
            issues.append(f"Missing: {labels_dir}")
        if not data_yaml.exists():
            issues.append(f"Missing: {data_yaml}")

        image_count = len(list(images_dir.glob("*.*"))) if images_dir.exists() else 0
        label_count = len(list(labels_dir.glob("*.txt"))) if labels_dir.exists() else 0

        return {
            "valid": len(issues) == 0 and image_count > 0,
            "issues": issues,
            "image_count": image_count,
            "label_count": label_count,
            "data_yaml": str(data_yaml),
        }

    def _create_data_yaml(self):
        """Auto-generate YOLO data.yaml if missing."""
        yaml_content = f"""
path: {self.dataset_path}
train: images/train
val: images/val

nc: 3
names:
  0: person
  1: suspicious_person
  2: theft_action
"""
        yaml_path = self.dataset_path / "data.yaml"
        yaml_path.parent.mkdir(parents=True, exist_ok=True)
        with open(yaml_path, "w") as f:
            f.write(yaml_content.strip())
        logger.info(f"Created data.yaml at {yaml_path}")

    def train(self, epochs=None, batch_size=None, db_session_id=None,
              on_complete=None):
        """Start training in a background thread."""
        global _training_status
        if _training_status["running"]:
            return False, "Training already in progress."

        epochs = epochs or self.config["epochs"]
        batch_size = batch_size or self.config["batch_size"]

        validation = self.validate_dataset()
        if not validation["valid"]:
            msg = f"Dataset invalid: {'; '.join(validation['issues'])}"
            return False, msg

        thread = threading.Thread(
            target=self._run_training,
            args=(epochs, batch_size, db_session_id, on_complete),
            daemon=True
        )
        thread.start()
        return True, "Training started."

    def _run_training(self, epochs, batch_size, session_id, on_complete):
        """Execute YOLOv8 training."""
        self.stop_requested = False
        self.last_loss_str = ""
        import time as _time
        global _training_status
        _training_status.update({
            "running": True,
            "progress": 0,
            "epoch": 0,
            "total_epochs": epochs,
            "status": "running",
            "message": "Initializing training...",
            "error": None,
            "results": None,
            "start_time": _time.time(),
        })
        _emit_progress(_training_status.copy())

        try:
            import torch
            logger.info("============== TRAINING ENVIRONMENT DIAGNOSTIC ==============")
            logger.info(f"Python interpreter: {os.sys.executable if hasattr(os, 'sys') else 'N/A'}")
            logger.info(f"PyTorch version: {torch.__version__}")
            logger.info(f"CUDA available: {torch.cuda.is_available()}")
            if torch.cuda.is_available():
                logger.info(f"Active GPU device: {torch.cuda.get_device_name(0)}")
                logger.info(f"CUDA device capability: {torch.cuda.get_device_capability(0)}")
            else:
                logger.warning("CUDA is NOT available on PyTorch in this process!")
            logger.info("=============================================================")

            from ultralytics import YOLO

            data_yaml = str(self.dataset_path / "data.yaml")
            model = YOLO(self.config["model_base"])

            _training_status["message"] = f"Training {epochs} epochs on dataset..."
            _emit_progress(_training_status.copy())

            # Custom callback for progress
            def on_train_epoch_end(trainer_cb):
                if self.stop_requested:
                    logger.info("Early stopping requested by user.")
                    trainer_cb.stop = True

                ep = trainer_cb.epoch + 1
                prog = int((ep / epochs) * 100)
                _training_status.update({
                    "epoch": ep,
                    "progress": prog,
                    "message": f"Epoch {ep}/{epochs} — Loss: {trainer_cb.loss:.4f}",
                })
                # Save latest loss string in status so we can save it later
                self.last_loss_str = f"Loss: {trainer_cb.loss:.4f}"
                _emit_progress(_training_status.copy())

            model.add_callback("on_train_epoch_end", on_train_epoch_end)

            results = model.train(
                data=data_yaml,
                epochs=epochs,
                batch=batch_size,
                imgsz=self.config["img_size"],
                project=str(self.output_dir),
                name="vigilant_eye",
                exist_ok=True,
                verbose=False,
                device=self.config.get("device", 0),
                workers=self.config.get("workers", 0),
                cache=self.config.get("cache", False),
                amp=self.config.get("amp", True),
                optimizer=self.config.get("optimizer", "auto"),
                patience=self.config.get("patience", 50),
                close_mosaic=self.config.get("close_mosaic", 10),
            )

            # Copy best weights
            best_src = self.output_dir / "vigilant_eye" / "weights" / "best.pt"
            best_dst = self.output_dir / "best.pt"
            if best_src.exists():
                import shutil
                shutil.copy(best_src, best_dst)
                logger.info(f"Best model saved to {best_dst}")

            map50 = float(results.results_dict.get("metrics/mAP50(B)", 0))

            if self.stop_requested:
                final_status = "stopped"
                final_message = "Stopped Successfully"
            else:
                final_status = "completed"
                final_message = f"Training complete! mAP50: {map50:.3f}"

            _training_status.update({
                "running": False,
                "progress": _training_status.get("progress", 0),
                "status": final_status,
                "message": final_message,
                "results": {"map50": map50, "model_path": str(best_dst)},
                "start_time": None,
            })
            _emit_progress(_training_status.copy())

            # Update DB session if provided
            if session_id:
                try:
                    from database.models import db, TrainingSession
                    session = TrainingSession.query.get(session_id)
                    if session:
                        session.completed_at = datetime.utcnow()
                        session.status = final_status
                        session.map50 = map50
                        session.model_path = str(best_dst)
                        session.notes = self.last_loss_str
                        db.session.commit()
                except Exception as e:
                    logger.error(f"DB session update error: {e}")

            if on_complete:
                on_complete(str(best_dst))

        except ImportError:
            _training_status.update({
                "running": False, "status": "failed",
                "error": "ultralytics not installed. Run: pip install ultralytics",
                "message": "Training failed — missing dependency.",
                "start_time": None,
            })
            _emit_progress(_training_status.copy())
        except torch.cuda.OutOfMemoryError as oom:
            err_msg = f"CUDA Out Of Memory during training: {oom}"
            logger.error(err_msg, exc_info=True)
            _training_status.update({
                "running": False, "status": "failed",
                "error": err_msg,
                "message": "Training failed: CUDA Out Of Memory. Try reducing batch size or image size.",
                "start_time": None,
            })
            _emit_progress(_training_status.copy())
        except RuntimeError as re:
            err_msg = str(re)
            if "CUDA" in err_msg or "device" in err_msg.lower() or "out of memory" in err_msg.lower():
                err_msg = f"Fatal CUDA Exception during training: {re}"
            else:
                err_msg = f"RuntimeError during training: {re}"
            logger.error(err_msg, exc_info=True)
            _training_status.update({
                "running": False, "status": "failed",
                "error": err_msg,
                "message": f"Training failed: {err_msg}",
                "start_time": None,
            })
            _emit_progress(_training_status.copy())
        except Exception as e:
            logger.error(f"Training error: {e}", exc_info=True)
            _training_status.update({
                "running": False, "status": "failed",
                "error": str(e), "message": f"Training failed: {e}",
                "start_time": None,
            })
            _emit_progress(_training_status.copy())

    @staticmethod
    def get_status():
        return _training_status.copy()

    def prepare_dataset_structure(self):
        """Create empty dataset folder structure for user to populate."""
        for split in ["train", "val"]:
            (self.dataset_path / "images" / split).mkdir(parents=True, exist_ok=True)
            (self.dataset_path / "labels" / split).mkdir(parents=True, exist_ok=True)
        self._create_data_yaml()
        return str(self.dataset_path)

    def stop_training(self):
        """Request training to stop and immediately broadcast a 'stopping' status."""
        if not _training_status["running"]:
            return False, "Training is not running."
        if self.stop_requested:
            return False, "Stop already requested — please wait."
        self.stop_requested = True
        # Immediately emit a status so the UI shows "Stopping..."
        _training_status["message"] = "Stop requested — finishing current epoch..."
        _training_status["status"] = "stopping"
        _emit_progress(_training_status.copy())
        return True, "Stop requested."


# Global singleton
trainer = ModelTrainer()
