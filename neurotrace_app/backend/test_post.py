import urllib.request, json, urllib.parse
from urllib.error import HTTPError

# Register explicitly
reg_req = urllib.request.Request(
    'http://127.0.0.1:8422/auth/register',
    data=json.dumps({
        'email': 'newtest@example.com', 
        'password': 'password', 
        'name': 'test name', 
        'username': 'newtest123',
        'age': 30
    }).encode(),
    headers={'Content-Type': 'application/json'}
)
try:
    urllib.request.urlopen(reg_req)
    print("Registered successfully.")
except HTTPError as e:
    print("Register info:", e.code, e.read().decode())
    # proceed to login if it was 400 existing email

auth_req = urllib.request.Request(
    'http://127.0.0.1:8422/auth/login',
    data=json.dumps({'email': 'newtest@example.com', 'password': 'password'}).encode(),
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(auth_req) as res:
        token = json.loads(res.read())['access_token']
        print("Logged in")
except HTTPError as e:
    print("Login error:", e.read().decode())
    exit(1)

with open('test_req.json', 'r') as f:
    pl = json.load(f)

# The predict payload expects some fields, check for missing fields
# The original API had issues with keyboard_polling_hz or similar

pred_req = urllib.request.Request(
    'http://127.0.0.1:8422/predict',
    data=json.dumps(pl).encode(),
    headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
)

try:
    with urllib.request.urlopen(pred_req) as res:
        print("Predict SUCCESS:", res.read().decode())
except HTTPError as e:
    print("Predict error:", e.code, e.read().decode())
except Exception as e:
    print("Predict other:", str(e))
