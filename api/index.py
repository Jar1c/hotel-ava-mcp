import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# Import the Flask app from backend
from app import app as application

handler = application
