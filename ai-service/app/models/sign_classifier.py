import numpy as np

class SignClassifier:
    def __init__(self):
        # In a real implementation, we would load a custom trained model (e.g. Keras, PyTorch, or TFLite)
        # to classify keypoint arrays.
        self.classes = ["hello", "thankyou", "yes", "no", "please", "sorry", "good", "bad", "help"]
        print("[SignClassifier] Loaded mock classification model.")

    def process_landmarks(self, landmarks_list):
        """
        Takes a list of 21 hand landmarks (each containing x, y, z coordinates) 
        and returns the predicted word.
        """
        if not landmarks_list or len(landmarks_list) < 21:
            return None
            
        # Standardize and normalize coordinates for robust prediction
        coords = np.array([[lm['x'], lm['y'], lm['z']] for lm in landmarks_list])
        
        # Center landmarks on the wrist (landmark 0)
        coords = coords - coords[0]
        
        # Simple rule-based mock logic for demonstration
        # E.g., if fingers are raised, predict "hello", if index and middle tap thumb, predict "no"
        # In a real scenario, this would feed into: self.model.predict(coords.flatten().reshape(1, -1))
        
        # Check if thumb tip (4) is close to index tip (8)
        distance = np.linalg.norm(coords[4] - coords[8])
        if distance < 0.05:
            return "no"
            
        # Check if palm is open (fingers extended far from wrist)
        avg_finger_distance = np.mean([np.linalg.norm(coords[i]) for i in [8, 12, 16, 20]])
        if avg_finger_distance > 0.4:
            return "hello"
            
        return "yes"
