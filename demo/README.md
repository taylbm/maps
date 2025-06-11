# CHIMP TMS Data Denial Demo

This demo visualizes GOES satellite data with TMS (Time-Matched Swath) data denial.

## URL Parameters

The demo supports specifying custom time ranges for the animation using URL parameters:

### Parameters

- `start`: The start date/time in UTC (YYYY-MM-DDThh:mm:ssZ or YYYY-MM-DD)
- `end`: The end date/time in UTC (YYYY-MM-DDThh:mm:ssZ or YYYY-MM-DD)

### UTC Time Format

⚠️ **Important**: All times are interpreted in UTC, not local time. 

- For ISO format dates, include the 'Z' suffix to explicitly specify UTC: `2023-05-01T12:00:00Z`
- For date-only format, times will default to 00:00 UTC: `2023-05-01` (equivalent to `2023-05-01T00:00:00Z`)
- If you omit the 'Z' suffix from a timestamp, it will still be interpreted as UTC

### Time Handling

- **Date-only parameters** (`YYYY-MM-DD`) are preserved exactly at 00:00:00 UTC
- **Timestamps with time components** (`YYYY-MM-DDThh:mm:ssZ`) are rounded to the nearest hour
- This allows for precise control of start times when needed

### Examples

1. **Specify start date only** (will show 12 hours from start):
   ```
   ?start=2023-05-01T12:00:00Z
   ```
   This will be rounded to 12:00:00 UTC.

2. **Specify both start and end date**:
   ```
   ?start=2023-05-01T12:00:00Z&end=2023-05-01T18:00:00Z
   ```
   These will be rounded to 12:00:00 UTC and 18:00:00 UTC.

3. **Date only** (will use exact 00:00 UTC time):
   ```
   ?start=2023-05-01&end=2023-05-02
   ```
   These will be exactly 00:00:00 UTC on May 1 and May 2.

4. **Mixed format**: 
   ```
   ?start=2023-05-01&end=2023-05-01T18:30:00Z
   ```
   Start will be exactly 00:00:00 UTC, end will be rounded to 19:00:00 UTC.

If no parameters are provided, the animation will default to showing the most recent 12 hours of data.

## Notes

- Only timestamps with time components are rounded to the hour (minutes, seconds are ignored)
- Date-only parameters are preserved exactly at 00:00:00 UTC
- All times are in UTC (Coordinated Universal Time)
- The maximum recommended time range is 24 hours (24 frames)
- Data availability may vary - frames with no data will be skipped
- Example current time: `?start=2023-05-01&end=2023-05-02` (a full day from midnight to midnight) 