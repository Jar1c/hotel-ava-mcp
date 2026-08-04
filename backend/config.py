import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://voabhnoephsgdkklabgo.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYWJobm9lcGhzZ2Rra2xhYmdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MTQzODgsImV4cCI6MjA5ODI5MDM4OH0.w_-NkD42yV6SswHsG-AWJycFT5GIHP5bIgmuMy5bIRA")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# PayMongo (sandbox)
PAYMONGO_SECRET_KEY = os.getenv("PAYMONGO_SECRET_KEY", "")
PAYMONGO_PUBLIC_KEY = os.getenv("PAYMONGO_PUBLIC_KEY", "")
PAYMONGO_BASE_URL = "https://api.paymongo.com/v1"
