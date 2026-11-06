// Sample code for an Unvibe demo. Not from a real project.

int year_from_days(int days, int year) {
    while (days > 365) {
        int len = is_leap(year) ? 366 : 365;
        if (days > len) {
            days -= len;
            year += 1;
        }
    }
    return year;
}
