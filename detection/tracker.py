"""
Vigilant Eye - SORT Tracker
==============================
Simple Online and Realtime Tracking (SORT) implementation
for multi-person tracking across video frames.
"""

import numpy as np
import logging
from scipy.optimize import linear_sum_assignment
from filterpy.kalman import KalmanFilter

logger = logging.getLogger(__name__)


def iou(bb_test, bb_gt):
    """Compute Intersection over Union between two bounding boxes."""
    xx1 = max(bb_test[0], bb_gt[0])
    yy1 = max(bb_test[1], bb_gt[1])
    xx2 = min(bb_test[2], bb_gt[2])
    yy2 = min(bb_test[3], bb_gt[3])
    w = max(0.0, xx2 - xx1)
    h = max(0.0, yy2 - yy1)
    inter = w * h
    area_test = (bb_test[2] - bb_test[0]) * (bb_test[3] - bb_test[1])
    area_gt = (bb_gt[2] - bb_gt[0]) * (bb_gt[3] - bb_gt[1])
    union = area_test + area_gt - inter
    return inter / union if union > 0 else 0.0


class KalmanBoxTracker:
    """Kalman filter-based tracker for a single bounding box."""
    count = 0

    def __init__(self, bbox):
        self.kf = KalmanFilter(dim_x=7, dim_z=4)
        self.kf.F = np.array([
            [1,0,0,0,1,0,0],
            [0,1,0,0,0,1,0],
            [0,0,1,0,0,0,1],
            [0,0,0,1,0,0,0],
            [0,0,0,0,1,0,0],
            [0,0,0,0,0,1,0],
            [0,0,0,0,0,0,1],
        ], dtype=float)
        self.kf.H = np.array([
            [1,0,0,0,0,0,0],
            [0,1,0,0,0,0,0],
            [0,0,1,0,0,0,0],
            [0,0,0,1,0,0,0],
        ], dtype=float)
        self.kf.R[2:, 2:] *= 10.0
        self.kf.P[4:, 4:] *= 1000.0
        self.kf.P *= 10.0
        self.kf.Q[-1, -1] *= 0.01
        self.kf.Q[4:, 4:] *= 0.01
        self.kf.x[:4] = self._bbox_to_z(bbox)

        KalmanBoxTracker.count += 1
        self.id = KalmanBoxTracker.count
        self.hits = 0
        self.hit_streak = 0
        self.age = 0
        self.time_since_update = 0
        self.history = []
        self.first_bbox = bbox
        self.zone_time = 0  # Frames spent in a zone

    def _bbox_to_z(self, bbox):
        x1, y1, x2, y2 = bbox
        w = x2 - x1
        h = y2 - y1
        cx = x1 + w / 2
        cy = y1 + h / 2
        s = w * h
        r = w / float(h) if h > 0 else 1.0
        return np.array([[cx], [cy], [s], [r]])

    def _z_to_bbox(self, x, score=None):
        w = np.sqrt(abs(x[2]) * abs(x[3]))
        h = abs(x[2]) / w if w > 0 else 0
        bbox = [
            x[0] - w / 2, x[1] - h / 2,
            x[0] + w / 2, x[1] + h / 2
        ]
        if score is not None:
            return bbox + [score]
        return bbox

    def update(self, bbox):
        self.time_since_update = 0
        self.hits += 1
        self.hit_streak += 1
        self.zone_time += 1
        self.kf.update(self._bbox_to_z(bbox))

    def predict(self):
        if self.kf.x[6] + self.kf.x[2] <= 0:
            self.kf.x[6] *= 0.0
        self.kf.predict()
        self.age += 1
        if self.time_since_update > 0:
            self.hit_streak = 0
        self.time_since_update += 1
        self.history.append(self._z_to_bbox(self.kf.x))
        return self.history[-1]

    def get_state(self):
        return self._z_to_bbox(self.kf.x)


class SORTTracker:
    """
    SORT: Simple Online Realtime Tracker.
    Tracks multiple people across frames and assigns unique IDs.
    """

    def __init__(self, max_age=30, min_hits=3, iou_threshold=0.3):
        self.max_age = max_age
        self.min_hits = min_hits
        self.iou_threshold = iou_threshold
        self.trackers = []
        self.frame_count = 0
        # Zone tracking: track_id -> frames in zone
        self.zone_durations = {}

    def update(self, detections):
        """
        Update tracker with new detections.
        detections: list of [x1, y1, x2, y2, confidence]
        Returns: list of [x1, y1, x2, y2, track_id]
        """
        self.frame_count += 1
        det_array = np.array(detections) if len(detections) > 0 else np.empty((0, 5))

        # Predict next positions
        trks = np.zeros((len(self.trackers), 5))
        to_del = []
        for i, trk in enumerate(trks):
            pos = self.trackers[i].predict()
            trks[i] = [pos[0], pos[1], pos[2], pos[3], 0]
            if np.any(np.isnan(pos)):
                to_del.append(i)
        for i in reversed(to_del):
            self.trackers.pop(i)
            trks = np.delete(trks, i, axis=0)

        # Match detections to trackers
        matched, unmatched_dets, unmatched_trks = self._match(det_array, trks)

        # Update matched trackers
        for m in matched:
            self.trackers[m[1]].update(det_array[m[0], :4])

        # Create new trackers for unmatched detections
        for i in unmatched_dets:
            self.trackers.append(KalmanBoxTracker(det_array[i, :4]))

        # Build output
        results = []
        i = len(self.trackers) - 1
        for trk in reversed(self.trackers):
            if trk.time_since_update < self.max_age and (
                trk.hit_streak >= self.min_hits or self.frame_count <= self.min_hits
            ):
                state = trk.get_state()
                results.append([*state, trk.id, trk.zone_time])
            i -= 1
            if trk.time_since_update > self.max_age:
                self.trackers.pop(i)

        return results

    def _match(self, detections, trackers):
        if len(trackers) == 0:
            return [], list(range(len(detections))), []
        if len(detections) == 0:
            return [], [], list(range(len(trackers)))

        iou_matrix = np.zeros((len(detections), len(trackers)))
        for d, det in enumerate(detections):
            for t, trk in enumerate(trackers):
                iou_matrix[d, t] = iou(det[:4], trk[:4])

        row_ind, col_ind = linear_sum_assignment(-iou_matrix)
        matched_indices = list(zip(row_ind, col_ind))

        unmatched_dets = [d for d in range(len(detections))
                          if d not in [m[0] for m in matched_indices]]
        unmatched_trks = [t for t in range(len(trackers))
                          if t not in [m[1] for m in matched_indices]]
        matched = [m for m in matched_indices
                   if iou_matrix[m[0], m[1]] >= self.iou_threshold]

        newly_unmatched = [m[0] for m in matched_indices
                           if iou_matrix[m[0], m[1]] < self.iou_threshold]
        unmatched_dets += newly_unmatched

        return matched, unmatched_dets, unmatched_trks

    def reset(self):
        """Reset tracker state."""
        self.trackers = []
        self.frame_count = 0
        KalmanBoxTracker.count = 0
