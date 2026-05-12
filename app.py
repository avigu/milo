import json
import datetime
from flask import Flask, render_template

app = Flask(__name__)

def get_daily_riddle():
    with open('riddles.json', 'r') as f:
        riddles = json.load(f)
    
    # Pick a riddle based on the day of the year
    day_of_year = datetime.datetime.now().timetuple().tm_yday
    riddle_index = day_of_year % len(riddles)
    return riddles[riddle_index]

@app.route('/')
def index():
    daily_riddle = get_daily_riddle()
    return render_template('index.html', riddle=daily_riddle)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
