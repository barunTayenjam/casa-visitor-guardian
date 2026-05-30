from flask import Flask
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

import pipeline
import state
from routes.detection import detection_bp
from routes.face import face_bp
from routes.system import system_bp

app.register_blueprint(detection_bp)
app.register_blueprint(face_bp)
app.register_blueprint(system_bp)


def init_app():
    pipeline.initialize()

    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or os.environ.get('FLASK_DEBUG') != '1':
        pipeline.start_rtsp_service()


init_app()

PORT = 8084

if __name__ == '__main__':
    print(f"OpenCV Microservice started on port {PORT}")
    print(f"Health check: http://localhost:{PORT}/health")
    print(f"Status check: http://localhost:{PORT}/status")
    app.run(host='0.0.0.0', port=PORT, threaded=True)
