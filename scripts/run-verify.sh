#!/bin/sh
export POSTGRES_PASSWORD=$1
cd /app
python3 verify-prune.py $2
