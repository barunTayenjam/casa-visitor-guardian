# Debug Summary: Frontend Event Image Display Issue

## Problem Statement
The frontend application, when accessed via `http://localhost:3020`, is unable to display motion event images on the `/events` page. The images are served by the backend service, which is accessible internally within the Docker network and directly via `http://localhost:9753`. The frontend is configured to proxy requests for `/events/` and `/snapshots/` through its Nginx server.

## Symptoms
- Images on the `/events` page do not load and their containers are not rendered in the HTML.
- Direct access to an image via the frontend's Nginx (`http://localhost:3020/events/motion_cam1_2025-07-08T05-55-00-934Z.jpg`) results in a `404 Not Found` error from Nginx.
- Accessing the same image directly via the backend's exposed port (`http://localhost:9753/events/motion_cam1_2025-07-08T05-55-00-934Z.jpg`) works correctly.
- There is an unexpected redirect from `http://localhost:3020/events/` to `http://localhost:3000/events/`.

## Steps Taken So Far

1.  **Initial Nginx Configuration Check:**
    *   Verified `nginx-manjaro.conf` had `proxy_pass` directives for `/events/` and `/snapshots/` pointing to `http://backend:9753`.

2.  **Attempted Nginx Proxy Fixes:**
    *   Added `proxy_redirect off;` to `/events/` and `/snapshots/` locations in `nginx-manjaro.conf` to prevent potential redirects from the backend.
    *   Added `proxy_buffering off;` to `/events/` and `/snapshots/` locations in `nginx-manjaro.conf` to address potential buffering issues.
    *   Modified `proxy_pass` to `http://backend:9753$request_uri;` for `/events/` and `/snapshots/` to ensure the full request URI is passed to the backend.
    *   Modified `proxy_pass` to `http://backend:9753/events/` and `http://backend:9753/snapshots/` respectively, to explicitly include the path.
    *   Introduced `rewrite ^/events/(.*)$ /public/events/$1 break;` and similar for snapshots, combined with `proxy_pass http://backend:9753;` to explicitly rewrite the path before proxying.

3.  **Frontend Direct Access Attempt (Bypass Nginx):**
    *   Modified `src/services/ApiService.ts` to construct image URLs using `http://localhost:9753` directly in production.
    *   **Result:** This caused a build error due to a syntax issue introduced during the modification. This approach was reverted as it's not the idiomatic way for a browser to access services within a Docker network.

4.  **Docker Environment Debugging:**
    *   Confirmed internal network connectivity between `frontend` and `backend` containers using `docker exec` and `wget` (e.g., `docker exec casa-visitor-guardian-frontend-1 wget http://backend:9753/events/motion_cam1_2025-07-08T05-55-00-934Z.jpg` which successfully downloaded the image).
    *   Added `error_log /var/log/nginx/error.log debug;` to `nginx-manjaro.conf` for detailed Nginx logging.
    *   **Result:** This caused the frontend container to enter a restart loop, indicating a critical Nginx configuration error. The debug log line was removed.

5.  **Frontend Application Debugging:**
    *   Added `console.log` statements in `src/pages/EventsPage.tsx` and `src/components/dashboard/EventGrid.tsx` to inspect the `events` data and `imageUrl` values at various stages of rendering.
    *   **Result:** Logs confirmed that `EventsPage` receives correct event data with valid `imageUrl`s (e.g., `http://localhost:9753/events/...`). However, the `EventGrid` component was not rendering the `img` tags or their containers, and its internal logs were not visible, suggesting the component itself was not being rendered or was receiving empty data.

6.  **Docker Cleanup:**
    *   Performed a full Docker cleanup (`docker-compose down --volumes --rmi all && docker system prune -f`) to eliminate any lingering stale configurations or images.

## Current Hypothesis
The persistent redirect from `http://localhost:3020` to `http://localhost:3000` is the primary blocker. This redirect is likely originating from the frontend application itself, possibly due to a misconfigured base URL or a hardcoded port reference within the React/Vite build process that assumes the internal container port (`3000`) rather than the externally exposed port (`3020`). Nginx is likely correctly proxying the initial request, but the application then redirects the browser to the wrong port.

## Next Steps
The focus needs to shift to identifying and correcting the source of the `localhost:3000` redirect within the frontend application's build or runtime configuration. This might involve examining Vite's configuration or React Router's setup if used.
