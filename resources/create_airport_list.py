''' Helper to transform the airports csv to a usable format'''

import csv

INPUT_FILE = "resources/airports.csv"

OUTPUT_FILE = "resources/airports_selected.js"


airports_selected = []
number_of_airports = 0

# opening the CSV file
with open(INPUT_FILE, mode='r')as input_file:

    # reading the CSV file
    csvFile = csv.reader(input_file)

    # displaying the contents of the CSV file
    for lines in csvFile:
        # only airports with IATA codes, schedules services and of a certain size
        selector = lines[13] and \
                   lines[11] == "yes" \
                   and (lines[2] == "medium_airport" or lines[2] == "large_airport")
        if selector:
            number_of_airports += 1
            airport_name = lines[13] + ", " + \
                           lines[3] + ", " + \
                           lines[10] + " " + \
                           lines[8]
                            # Iata + name + municipality + iso country

            airport_name = airport_name.replace('"', '\\"')
            airport_name = airport_name.strip()
            temp_airport = [airport_name,
                            lines[4],
                            lines[5]]
            print(temp_airport)
            airports_selected.append(temp_airport)

# print(airports_selected)


airports_selected.sort(key=lambda x: x[0])

print("Airports selected: " + str(number_of_airports))

with open(OUTPUT_FILE, mode='w')as out_file:
    out_file.write('export const airports = [\n')
    for airport in airports_selected:
        out_file.write('["'+airport[0]+'"')
        out_file.write(', ' + airport[1])
        out_file.write(', ' + airport[2])
        out_file.write("]")
        if airport != airports_selected[-1]:  # don't add a comma to the last one
            out_file.write(",")
        out_file.write("\n")
    out_file.write('];\n')
