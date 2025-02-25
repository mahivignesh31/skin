import os
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential, Model
from tensorflow.keras.layers import Dense, Conv2D, MaxPooling2D, Flatten, Dropout, Input, BatchNormalization
from tensorflow.keras.preprocessing.image import load_img, img_to_array
from tensorflow.keras.applications import VGG16
from tensorflow.keras.applications.vgg16 import preprocess_input
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import cv2
import logging

app = Flask(__name__)
CORS(app)

# Constants
IMAGE_SIZE = 224
CLASSES = ['Actinic keratoses and intraepithelial carcinoma', 'Basal cell carcinoma', 
           'Benign keratosis-like lesions', 'Dermatofibroma', 'Melanoma', 
           'Melanocytic nevi', 'Vascular lesions']

# Configure logging
logging.basicConfig(level=logging.INFO)

# Load and preprocess the metadata
df = pd.read_csv(os.path.join(os.path.dirname(__file__), 'HAM10000_metadata.csv'))

# Model Architecture
def create_hybrid_model():
    # VGG16 as feature extractor
    base_model = VGG16(weights='imagenet', include_top=False,
                      input_shape=(IMAGE_SIZE, IMAGE_SIZE, 3))
    
    # Freeze only the first few layers of the base model
    for layer in base_model.layers[:15]:
        layer.trainable = False
    
    # Custom classification layers with batch normalization
    x = Flatten()(base_model.output)
    x = Dense(1024, activation='relu')(x)
    x = BatchNormalization()(x)
    x = Dropout(0.5)(x)
    x = Dense(512, activation='relu')(x)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)
    outputs = Dense(len(CLASSES), activation='softmax')(x)
    
    model = Model(inputs=base_model.input, outputs=outputs)
    return model

# Initialize the model
model = create_hybrid_model()

# Load pre-trained weights if available
checkpoint_dir = os.path.join(os.path.dirname(__file__), 'checkpoints')
checkpoint_path = os.path.join(checkpoint_dir, 'skin_cancer_model.h5')

if not os.path.exists(checkpoint_dir):
    os.makedirs(checkpoint_dir)

if os.path.exists(checkpoint_path):
    model.load_weights(checkpoint_path)

def preprocess_image(image_path):
    try:
        # Load and resize image
        img = cv2.imread(image_path)
        img = cv2.resize(img, (IMAGE_SIZE, IMAGE_SIZE))
        
        # Apply preprocessing
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = preprocess_input(img)  # Use VGG16 preprocessing
        
        # Add batch dimension
        img = np.expand_dims(img, axis=0)
        return img
    except Exception as e:
        logging.error(f"Error in preprocessing image: {str(e)}")
        raise

@app.route('/predict', methods=['POST'])
def predict():
    try:
        # Check if image file is present in request
        if 'image' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No image file provided'
            }), 400
        
        file = request.files['image']
        if not file.filename:
            return jsonify({
                'success': False,
                'error': 'Empty file provided'
            }), 400
        
        # Ensure temp directory exists
        temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
            
        # Save the uploaded file temporarily
        temp_path = os.path.join(temp_dir, 'temp_image.jpg')
        file.save(temp_path)
        
        try:
            # Preprocess the image
            processed_image = preprocess_image(temp_path)
            
            # Make prediction
            predictions = model.predict(processed_image)
            logging.info(f"Predictions: {predictions}")

            # Get the predicted class and probability
            predicted_class_idx = np.argmax(predictions[0])
            probability = float(predictions[0][predicted_class_idx])
            
            # Format probabilities as percentage with 2 decimal places
            all_probabilities = {
                class_name: round(float(prob) * 100, 2)
                for class_name, prob in zip(CLASSES, predictions[0])
            }
            
            # Return prediction results
            response = {
                'success': True,
                'predicted_class': CLASSES[predicted_class_idx],
                'probability': round(probability * 100, 2),
                'all_probabilities': all_probabilities
            }
            
        except Exception as e:
            logging.error(f"Error processing image: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Error processing image: {str(e)}'
            }), 500
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.remove(temp_path)
        
        return jsonify(response)
        
    except Exception as e:
        logging.error(f"Server error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)