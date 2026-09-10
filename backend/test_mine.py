import sys
sys.path.insert(0, r'D:\download\Capstone2\Hotel Ava\backend')
from app import app

with app.test_client() as c:
    # No token
    r = c.get('/api/bookings/mine')
    print('No token:', r.status_code, r.get_json())

    # Bad token
    r2 = c.get('/api/bookings/mine', headers={'Authorization': 'Bearer badtoken'})
    print('Bad token:', r2.status_code, r2.get_json())
