import json
import re
from default_api import oxylabs_web_search

wineries = [
    "יקב שמשון ודלילה - חוות אחוזת החאן",
    "יקב קסטל",
    "יקב בזק",
    "יקב טורא",
    "יקב כביר",
    "יקב לה פורה בלאנש",
    "יקבי גוש עציון",
    "יקב דרימיה",
    "יקב שילה",
    "יקב הר ברכה",
    "יקב בית אל",
    "יקב גבעות",
    "יקב ענתות",
    "יקב לטרון (מנזר לטרון)",
    "יקב פלם",
    "יקב עמק האלה",
    "יקב קטלב",
    "יקב פס גות",
    "יקב צפרירים",
    "יקב צרעה",
    "יקב אולו",
    "יקב צובה",
    "יקב נבו",
    "יקב סוסון ים",
    "יקב רביב",
    "יקבי ירושלים",
    "יקב נחום", # Potentially closed Saturday
    "יקב מרשה", # Potentially closed Saturday
    "יקב שריגים",
    "יקב קדמא",
    "יקב מטלר",
    "Diamond Winery",
    "יקב גינתון",
    "Meishar Winery",
    "Zohar Winery",
    "Villa Wilhelma",
    "יקב אלכסנדר",
    "יקב בן חיים",
    "יקב בת שלמה",
    "יקב ויתקין",
    "יקב לוינסון",
    "כרם יקב דניאלה",
    "יקב ליבנה",
    "יקב אחת",
    "יקב הים האדום",
    "יקב דלתון",
    "יקב נווה ירק"
]

collected_data = []

for winery_name in wineries:
    details = {
        "שם היקב": winery_name,
        "טלפון": "N/A",
        "כתובת": "N/A",
        "אתר אינטרנט": "N/A",
        "שעות פתיחה שבת": "יש לבדוק",
        "הערות/סיכום": ""
    }

    search_query = f"{winery_name} טלפון כתובת שעות פתיחה שבת"
    try:
        search_response = oxylabs_web_search(query=search_query, count=3)
        if search_response and search_response['output']:
            results = json.loads(search_response['output'])['results']
            
            for res in results:
                # Extract phone number
                phone_match = re.search(r'\b\\d{2,3}[-.\\s]?\\d{7,8}\\b', res['description'] + res['title'])
                if phone_match:
                    details["טלפון"] = phone_match.group(0).replace('-', '') # remove dashes for consistency
                
                # Extract website
                if "url" in res:
                    details["אתר אינטרנט"] = res["url"]
                
                # Extract address (very basic, might need refinement for accuracy)
                address_keywords = ["כתובת", "רחוב", "מושב", "קיבוץ", "כפר", "שדרות"]
                for keyword in address_keywords:
                    if keyword in res['description'] or keyword in res['title']:
                        # This is a very simplistic address extraction. A real solution would use NLP or structured data.
                        # For now, just taking a snippet around the keyword.
                        snippet_match = re.search(f'{keyword}[^.,;]*[^.,;]*[^.,;]*', res['description'] + res['title'])
                        if snippet_match:
                             details["כתובת"] = snippet_match.group(0)
                             break
                
                # Check for Saturday opening hours/closure
                if "שבת" in res['description'] or "שבת" in res['title']:
                    if "סגור בשבת" in res['description'] or "סגור בשבת" in res['title']:
                        details["שעות פתיחה שבת"] = "סגור"
                    elif "פתוח בשבת" in res['description'] or "פתוח בשבת" in res['title'] or "שעות פעילות שבת" in res['description'] or "שעות פעילות שבת" in res['title']:
                        # Attempt to extract actual hours if mentioned
                        hours_match = re.search(r'(פתוח|פעילות)?\\s?בשבת:\\s?[\\d\\.:-]+\\s?-\\s?[\\d\\.:-]+', res['description'] + res['title'])
                        if hours_match:
                            details["שעות פתיחה שבת"] = hours_match.group(0)
                        else:
                            details["שעות פתיחה שבת"] = "פתוח (מומלץ לבדוק שעות)"
                
                # Add notes based on search results
                if winery_name == "יקב נחום" and ("סגור בשבת" in res['description'] or "סגור בשבת" in res['title']):
                    details["הערות/סיכום"] = "צוין כסגור בשבת"
                if winery_name == "יקב מרשה" and ("סגור בשבת" in res['description'] or "סגור בשבת" in res['title']):
                    details["הערות/סיכום"] = "צוין כסגור בשבת"

                # If we found enough details, break
                if details["טלפון"] != "N/A" and details["כתובת"] != "N/A" and details["אתר אינטרנט"] != "N/A":
                    break

    except Exception as e:
        details["הערות/סיכום"] = f"שגיאה בחיפוש: {e}"
    
    collected_data.append(details)

# Generate Markdown table
markdown_table = "| שם היקב | טלפון | כתובת | אתר אינטרנט | שעות פתיחה שבת | הערות/סיכום |\n"
markdown_table += "|---|---|---|---|---|---|\n"
for entry in collected_data:
    markdown_table += (
        f"| {entry['שם היקב']} | {entry['טלפון']} | {entry['כתובת']} | "
        f"{entry['אתר אינטרנט']} | {entry['שעות פתיחה שבת']} | {entry['הערות/סיכום']} |\n"
    )

print(markdown_table)

# Generate Summary
summary = "\n### סיכום ממצאי חיפוש היקבים\n\n"
summary += f"נאספו פרטים עבור {len(collected_data)} יקבים. להלן כמה דגשים:\n"
found_closed_saturday = [w['שם היקב'] for w in collected_data if w['שעות פתיחה שבת'] == 'סגור']
if found_closed_saturday:
    summary += f"- מספר יקבים צוינו במפורש כסגורים בשבת: {', '.join(found_closed_saturday)}.\n"

wineries_with_phone = [w['שם היקב'] for w in collected_data if w['טלפון'] != 'N/A']
summary += f"- פרטי טלפון נמצאו עבור {len(wineries_with_phone)} יקבים. עבור השאר, יש לבצע בדיקה נוספת.\n"

summary += "- מומלץ לוודא שעות פתיחה לשבת ישירות מול היקב הרצוי, גם אם צוין 'פתוח'.\n"
summary += "- שימו לב לפרטי הכתובת, חלקם כלליים ודורשים אימות לניווט מדויק.\n"
print(summary)
