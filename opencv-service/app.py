from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import hmac

app = Flask(__name__)
CORS(app)

API_TOKEN = os.environ.get('OPENCV_API_TOKEN', '')

PUBLIC_PATHS = {'/health'}


@app.before_request
def require_api_token():
    if request.method == 'OPTIONS':
        return None
    if request.path in PUBLIC_PATHS:
        return None
    if not API_TOKEN:
        return jsonify({'error': 'API token not configured'}), 500
    token = request.headers.get('X-API-Token', '')
    if not token or not hmac.compare_digest(token, API_TOKEN):
        return jsonify({'error': 'Unauthorized'}), 401
    return None

import pipeline
import state
from routes.detection import detection_bp
from routes.face import face_bp
from routes.system import system_bp

app.register_blueprint(detection_bp)
app.register_blueprint(face_bp)
app.register_blueprint(system_bp)


def init_app():
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not os.environ.get('WERKZEUG_RUN_MAIN'):
        pipeline.initialize()
    try:
        if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or os.environ.get('FLASK_DEBUG') != '1':
            pipeline.start_rtsp_service()
    except Exception as e:
        print(f"init_app error: {e}", flush=True)

# Initialize app safely
try:
    init_app()
except Exception as e:
    print(f"Failed to init app: {e}", flush=True)

PORT = 8084

if __name__ == '__main__':
    print(f"OpenCV Microservice started on port {PORT}")
    print(f"Health check: http://localhost:{PORT}/health")
    print(f"Status check: http://localhost:{PORT}/status")
    app.run(host='0.0.0.0', port=PORT, threaded=True)
