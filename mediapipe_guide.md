# Guide: Customizing & Training Local MediaPipe for Sign Language Recognition

This guide explains how the platform uses local browser-based **MediaPipe Tasks Vision** to translate hand gestures, and how you can **teach (train)** the model custom sign language vocabulary (e.g., ASL alphabets or greetings) to convert them into spoken language.

---

## 1. How the Current Implementation Works

The application uses Google's pre-trained **MediaPipe Gesture Recognizer** model.
- **Model Path**: `https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`
- **Pre-trained Gestures**: It natively recognizes 7 default gestures: `Thumb_Up`, `Thumb_Down`, `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Victory`, and `ILoveYou`.
- **Mapping File**: The translation logic maps these raw gesture outputs into conversational words inside `frontend/src/lib/gestureMapping.ts` and `frontend/src/hooks/useSignLanguageTranslation.ts`:
  ```typescript
  // Example Mapping
  if (category === "Thumb_Up") mappedWord = "Yes";
  if (category === "Thumb_Down") mappedWord = "No";
  if (category === "Closed_Fist") mappedWord = "Wait";
  if (category === "Open_Palm") mappedWord = "Stop";
  if (category === "Pointing_Up") mappedWord = "Look";
  if (category === "Victory") mappedWord = "Peace";
  if (category === "ILoveYou") mappedWord = "I Love You";
  ```
- **Text-to-Speech**: The resulting words are fed into the browser's native `SpeechSynthesis` API to speak the translated text out loud for other participants.

---

## 2. Option A: Customizing Simple Mappings (No Training Required)

If you just want to change what words are spoken when the default 7 gestures are performed, you can simply edit `/frontend/src/lib/gestureMapping.ts` or the mapping logic in `useSignLanguageTranslation.ts`.

For example, to map `Open_Palm` to mean `"Hello!"` instead of `"Stop"`, update your mappings like this:
```typescript
if (category === "Open_Palm") mappedWord = "Hello!";
```

---

## 3. Option B: Training a Custom Model to Teach New Signs (Full Sign Language)

To make MediaPipe recognize true sign language words (like *"Thank You"*, *"Help"*, *"Please"*, or alphabet letters), you must train a **custom gesture recognizer model**. Google makes this easy using **MediaPipe Studio** or **MediaPipe Model Maker**.

### Step 1: Collect a Dataset
For each gesture you want to teach the model:
1. Create a folder named after the gesture (e.g., `thank_you`, `please`, `help`).
2. Record video clips or capture images of yourself and others performing the sign.
3. Aim for **100+ images per gesture** from different angles, distances, hand placements, and lighting conditions.
4. Add a folder named `none` containing images of your hand relaxed or doing normal movements to avoid false positives.

Your dataset directory structure should look like this:
```text
dataset/
├── thank_you/
│   ├── img1.jpg
│   ├── img2.jpg
│   └── ...
├── please/
│   ├── img1.jpg
│   └── ...
└── none/
    ├── img1.jpg
    └── ...
```

---

### Step 2: Train Using MediaPipe Model Maker (Python)

MediaPipe Model Maker uses transfer learning to train a neural network using your custom images in minutes.

1. Install the required Python packages:
   ```bash
   pip install mediapipe-model-maker
   ```

2. Run the following Python script to train your custom model:
   ```python
   import os
   from mediapipe_model_maker import gesture_recognizer

   # 1. Define the dataset directory path
   IMAGES_PATH = "dataset"

   # 2. Load the dataset
   data = gesture_recognizer.Dataset.from_folder(
       dirname=IMAGES_PATH,
       hparams=gesture_recognizer.DatasetHParams(min_detection_confidence=0.5)
   )

   # 3. Split dataset into train, validation, and test sets
   train_data, remaining_data = data.split(0.8)
   validation_data, test_data = remaining_data.split(0.5)

   # 4. Train the model using pre-trained hand-landmark features
   hparams = gesture_recognizer.HParams(
       export_dir="exported_model",
       epochs=15,
       batch_size=4
   )
   model_options = gesture_recognizer.ModelOptions(dropout_rate=0.05)
   options = gesture_recognizer.GestureRecognizerOptions(
       model_options=model_options,
       hparams=hparams
   )
   
   model = gesture_recognizer.GestureRecognizer.create(
       train_data=train_data,
       validation_data=validation_data,
       options=options
   )

   # 5. Evaluate the model performance
   loss, acc = model.evaluate(test_data)
   print(f"Test accuracy: {acc:.4f}")

   # 6. Export the model as a .task file
   model.export_model()
   ```

After running this script, you will find your custom model file (usually named `gesture_recognizer.task`) inside the `exported_model/` folder.

---

### Step 3: Train Using MediaPipe Studio (No-Code GUI)

If you prefer a visual, no-code web interface:
1. Go to [Google MediaPipe Studio](https://mediapipe-studio.webapps.google.com/) on your browser.
2. Select **Gesture Recognizer** task.
3. Upload your dataset folders directly.
4. Click **Train Model** and customize settings visually.
5. Download the final `.task` file once training completes.

---

## 4. Integrating the Custom Model Into the Web App

Once you have your new `custom_gestures.task` model file:

1. **Place the model file in the public directory**:
   Move the file to `/frontend/public/custom_gestures.task`.

2. **Update the hook initialization**:
   Open `frontend/src/hooks/useSignLanguageTranslation.ts` and modify `modelAssetPath` to load from your local server:
   ```diff
   const recognizer = await GestureRecognizer.createFromOptions(vision, {
     baseOptions: {
   -   modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
   +   modelAssetPath: "/custom_gestures.task", // Loaded locally from your public folder!
       delegate: "GPU",
     },
     runningMode: "VIDEO",
     numHands: 1,
   });
   ```

3. **Also update the mute-user gesture recognizer hook**:
   Open `frontend/src/hooks/useGestureRecognition.ts` and apply the same path change:
   ```diff
   - modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
   + modelAssetPath: "/custom_gestures.task",
   ```

4. **Add your new labels and translations to the mapping**:
   Update your mapping inside `useSignLanguageTranslation.ts` and `frontend/src/lib/gestureMapping.ts` to output your new translated phrases:
   ```typescript
   // Map custom category names trained in your model to spoken speech sentences
   if (category === "thank_you") mappedWord = "Thank you so much";
   if (category === "please") mappedWord = "Please, can you help me?";
   if (category === "help") mappedWord = "I need assistance";
   ```

Now, whenever you perform your custom gestures in front of the camera, local MediaPipe will recognize them instantly in the browser and translate them into custom spoken language for everyone in the room!
