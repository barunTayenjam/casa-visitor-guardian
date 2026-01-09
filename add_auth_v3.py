#!/usr/bin/env python3
"""
Script to add authentication middleware to API routes in index.ts
"""

import re

def add_authentication_to_routes(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    # Routes that should NOT require authentication (public endpoints)
    public_routes = [
        '/health',
        '/api/health',
        '/api/system/health',
        '/snapshot/:cameraId.jpg',
        '/stream/:cameraId',
        '/stream/:cameraId/test',
    ]

    new_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]
        new_lines.append(line)

        # Pattern to match route definitions
        route_match = re.search(r"app\.(get|post|put|delete|patch)\s*\(['\"]([^'\"]+)['\"]\s*,", line)

        if route_match:
            route_path = route_match.group(2)

            # Check if it's a public route
            if not any(public_route in route_path for public_route in public_routes):
                # Check if it's an API route
                if route_path.startswith('/api/'):
                    # Check if next line already has middleware
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()

                        # Check if next line has handler definition
                        if '(req: Request, res: Response)' in lines[i + 1]:
                            # Check if middleware already present
                            if not any(mw in lines[i + 1] for mw in ['requireUser', 'requireAdmin', 'validate(']):
                                # Add requireUser, before (req: Request...
                                indent = len(line) - len(line.lstrip())
                                new_line = lines[i + 1].replace('(req: Request, res: Response)', 'requireUser, (req: Request, res: Response)')
                                new_lines.append(new_line)
                                i += 1  # Skip the original handler line
                        else:
                            # Handler on a different line, just continue
                            pass

        i += 1

    # Write back
    with open(file_path, 'w') as f:
        f.writelines(new_lines)

    print(f"Processed {file_path}")

if __name__ == '__main__':
    file_path = '/home/barun/Documents/home-security-non-docker/server/src/routes/index.ts'
    add_authentication_to_routes(file_path)
