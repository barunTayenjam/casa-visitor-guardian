from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import hmac

app = Flask(__name__)
CORS(app)

API_TOKEN = os.environ.get('RELATIONS_API_TOKEN', os.environ.get('OPENCV_API_TOKEN', ''))

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


from relations_routes import relations_bp

app.register_blueprint(relations_bp)


@app.get('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'relations'}), 200


PORT = int(os.environ.get('PORT', 8085))

if __name__ == '__main__':
    print(f"Relations service started on port {PORT}")
    print(f"Health check: http://localhost:{PORT}/health")
    app.run(host='0.0.0.0', port=PORT, threaded=True)
