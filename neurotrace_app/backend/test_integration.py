import json, urllib.request, urllib.parse

def req(url, data=None, headers=None, method="POST"):
    if data is not None and not isinstance(data, bytes):
        if headers and headers.get('Content-Type') == 'application/x-www-form-urlencoded':
            data = urllib.parse.urlencode(data).encode()
        else:
            data = json.dumps(data).encode()
    if not headers: headers = {}
    if data:
        if 'Content-Type' not in headers: headers['Content-Type'] = 'application/json'
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

# 1. Register/Login
print("Registering...")
s, d = req('http://127.0.0.1:8421/register', {'email':'x@x.com','password':'x','name':'X','age':30})
print("Login...")
s, d = req('http://127.0.0.1:8421/login', {'username':'x@x.com','password':'x'}, {'Content-Type': 'application/x-www-form-urlencoded'})
token = d['access_token']
print("Got token")

# 2. Predict
print("Predicting...")
pl = json.load(open('test_req.json'))
s, d = req('http://127.0.0.1:8421/predict', pl, {'Authorization': f'Bearer {token}'})
print(f"Status: {s}")
print(f"Data: {json.dumps(d, indent=2)}")
