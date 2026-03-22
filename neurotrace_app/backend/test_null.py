import urllib.request, json
from urllib.error import HTTPError

# Login
auth_req = urllib.request.Request(
    'http://127.0.0.1:8421/auth/login',
    data=json.dumps({'email': 'reqtest2@example.com', 'password': 'password'}).encode(),
    headers={'Content-Type': 'application/json'}
)
try:
    with urllib.request.urlopen(auth_req) as res:
        token = json.loads(res.read())['access_token']
except HTTPError as e:
    # Just grab an existing user from the database or register
    print("Login error:", e.read().decode())
    exit(1)

# Forge a payload with explicit nulls
ks = [{"keyId": "a", "hold_time": 100.0, "latency": None, "flight_time": None}] * 150
pl = {"sessionId":"test_persistent_123", "startTime":1000, "keystrokeEvents": ks, "keyboard_polling_hz": None}

pred_req = urllib.request.Request(
    'http://127.0.0.1:8421/predict',
    data=json.dumps(pl).encode(),
    headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
)

try:
    with urllib.request.urlopen(pred_req) as res:
        print("Success!")
except HTTPError as e:
    print("Predict HTTP error:", e.code, e.read().decode())
