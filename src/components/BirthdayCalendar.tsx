import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { userApi, endpoints } from '../api/client';
import { SafeImage } from './SafeImage';
import { CalendarIcon, RefreshIcon } from './Icon';

interface BirthdayReminderDTO {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  birthday: string;
  isToday: boolean;
  isTomorrow: boolean;
  daysUntilBirthday: number;
}

export const BirthdayCalendar: React.FC = () => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = createStyles(theme);
  const [birthdays, setBirthdays] = useState<BirthdayReminderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    loadBirthdays();
  }, [currentDate]);

  const loadBirthdays = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const daysFromTodayToEndOfMonth = Math.max(0, Math.ceil((lastDayOfMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      const daysAhead = Math.max(365, daysFromTodayToEndOfMonth + 30);
      
      const response = await userApi.get(endpoints.getUpcomingBirthdays(daysAhead));
      const birthdayDTOs = response.data || [];
      const birthdayReminders: BirthdayReminderDTO[] = birthdayDTOs.map((dto: any) => ({
        id: dto.id || dto.userId,
        userId: dto.userId,
        username: dto.username,
        avatarUrl: dto.avatarUrl || '',
        birthday: dto.birthday,
        isToday: dto.isToday,
        isTomorrow: dto.isTomorrow,
        daysUntilBirthday: dto.daysUntilBirthday
      }));
      setBirthdays(birthdayReminders || []);
    } catch (error) {
      console.error('Failed to load birthdays:', error);
      setBirthdays([]);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    return { daysInMonth, startingDayOfWeek };
  };

  const getBirthdaysForDate = (date: Date) => {
    const targetDay = date.getDate();
    const targetMonth = date.getMonth() + 1;
    
    return birthdays.filter(birthday => {
      try {
        const birthdayStr = birthday.birthday;
        let birthdayDate: Date;
        
        if (birthdayStr.includes('T') || birthdayStr.includes('Z')) {
          const datePart = birthdayStr.split('T')[0];
          const [year, month, day] = datePart.split('-').map(Number);
          birthdayDate = new Date(Date.UTC(year, month - 1, day));
        } else {
          const [year, month, day] = birthdayStr.split('-').map(Number);
          birthdayDate = new Date(Date.UTC(year, month - 1, day));
        }
        
        const birthdayDay = birthdayDate.getUTCDate();
        const birthdayMonth = birthdayDate.getUTCMonth() + 1;
        
        return birthdayDay === targetDay && birthdayMonth === targetMonth;
      } catch (error) {
        console.error('Error parsing birthday date:', birthday.birthday, error);
        return false;
      }
    });
  };

  const isBirthdayPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today && compareDate.getFullYear() === today.getFullYear();
  };

  const monthNames = [
    t('calendar.months.january', undefined, 'January'),
    t('calendar.months.february', undefined, 'February'),
    t('calendar.months.march', undefined, 'March'),
    t('calendar.months.april', undefined, 'April'),
    t('calendar.months.may', undefined, 'May'),
    t('calendar.months.june', undefined, 'June'),
    t('calendar.months.july', undefined, 'July'),
    t('calendar.months.august', undefined, 'August'),
    t('calendar.months.september', undefined, 'September'),
    t('calendar.months.october', undefined, 'October'),
    t('calendar.months.november', undefined, 'November'),
    t('calendar.months.december', undefined, 'December')
  ];

  const dayNames = [
    t('calendar.days.sun', undefined, 'Sun'),
    t('calendar.days.mon', undefined, 'Mon'),
    t('calendar.days.tue', undefined, 'Tue'),
    t('calendar.days.wed', undefined, 'Wed'),
    t('calendar.days.thu', undefined, 'Thu'),
    t('calendar.days.fri', undefined, 'Fri'),
    t('calendar.days.sat', undefined, 'Sat')
  ];

  const formatDate = (date: Date) => {
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    return `${monthNames[monthIndex]} ${year}`;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() && 
           date.getMonth() === selectedDate.getMonth() && 
           date.getFullYear() === selectedDate.getFullYear();
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: startingDayOfWeek }, (_, i) => i);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <CalendarIcon size={18} color={colors.text} />
          <Text style={styles.headerText}>{t('calendar.title', undefined, 'Birthday Calendar')}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={loadBirthdays} style={styles.iconButton}>
            <RefreshIcon size={16} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.iconButton}>
            <Text style={styles.iconText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.iconButton}>
            <Text style={styles.iconText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Month/Year */}
      <View style={styles.monthYearContainer}>
        <Text style={styles.monthYearText}>{formatDate(currentDate)}</Text>
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {/* Day Headers */}
        {dayNames.map(day => (
          <View key={day} style={styles.dayHeader}>
            <Text style={styles.dayHeaderText}>{day}</Text>
          </View>
        ))}
        
        {/* Empty Days */}
        {emptyDays.map((_, index) => (
          <View key={`empty-${index}`} style={styles.dayCell} />
        ))}
        
        {/* Calendar Days */}
        {days.map(day => {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
          const dayBirthdays = getBirthdaysForDate(date);
          const hasBirthdays = dayBirthdays.length > 0;
          const isPast = isBirthdayPast(date);
          
          return (
            <TouchableOpacity
              key={day}
              onPress={() => setSelectedDate(date)}
              style={[
                styles.dayCell,
                isToday(date) && styles.todayCell,
                isSelected(date) && styles.selectedCell,
                hasBirthdays && !isPast && styles.hasBirthdayCell,
                hasBirthdays && isPast && styles.pastBirthdayCell,
              ]}
            >
              <Text style={[
                styles.dayText,
                isToday(date) && styles.todayText,
                isSelected(date) && styles.selectedText,
                hasBirthdays && !isPast && styles.birthdayText,
              ]}>
                {day}
              </Text>
              {hasBirthdays && (
                <View style={[
                  styles.birthdayDot,
                  isPast && styles.pastBirthdayDot
                ]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected Date Birthdays */}
      {selectedDate && (
        <View style={styles.selectedDateContainer}>
          <Text style={styles.selectedDateTitle}>
            {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
          {getBirthdaysForDate(selectedDate).length > 0 ? (
            <ScrollView style={styles.birthdayList}>
              {getBirthdaysForDate(selectedDate).map((birthday, index) => {
                const isPast = isBirthdayPast(selectedDate);
                // Calculate days until birthday from today (not from selected date)
                // The API provides daysUntilBirthday calculated from today
                const daysUntil = birthday.daysUntilBirthday;
                
                return (
                  <View 
                    key={`${birthday.userId}-${index}`}
                    style={[
                      styles.birthdayItem,
                      isPast && styles.pastBirthdayItem
                    ]}
                  >
                    <View style={[
                      styles.birthdayAvatar,
                      isPast && styles.pastBirthdayAvatar
                    ]}>
                      {birthday.avatarUrl ? (
                        <SafeImage 
                          source={{ uri: birthday.avatarUrl }} 
                          style={styles.avatarImage}
                          fallbackUri={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(birthday.username)}`}
                          placeholder={birthday.username.charAt(0).toUpperCase()}
                        />
                      ) : (
                        <Text style={styles.avatarText}>
                          {birthday.username.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.birthdayInfo}>
                      <Text style={styles.birthdayUsername}>{birthday.username}</Text>
                      <Text style={styles.birthdayCountdown}>
                        {isPast 
                          ? t('calendar.alreadyPassed', undefined, 'Already happened this year')
                          : daysUntil === 0 
                            ? t('calendar.today', undefined, 'Today!')
                            : daysUntil === 1 
                            ? t('calendar.tomorrow', undefined, 'Tomorrow')
                            : t('calendar.inDays', { days: daysUntil }, `In ${daysUntil} days`)
                        }
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.noBirthdaysText}>
              {t('calendar.noBirthdays', undefined, 'No birthdays on this date')}
            </Text>
          )}
        </View>
      )}

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsLabel}>
          {t('calendar.upcomingBirthdays', undefined, 'Upcoming Birthdays')}
        </Text>
        <Text style={styles.statsValue}>{birthdays.length}</Text>
      </View>
    </View>
  );
};

const createStyles = (theme: string) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    flex: 1,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.muted,
  },
  monthYearContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  monthYearText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  dayHeader: {
    width: '14.28%',
    paddingVertical: 8,
    alignItems: 'center',
  },
  dayHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  todayCell: {
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  selectedCell: {
    backgroundColor: theme === 'dark' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
    borderRadius: 8,
  },
  hasBirthdayCell: {
    backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
  },
  pastBirthdayCell: {
    opacity: 0.6,
  },
  dayText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  todayText: {
    color: 'white',
    fontWeight: '700',
  },
  selectedText: {
    color: colors.primary,
    fontWeight: '600',
  },
  birthdayText: {
    color: theme === 'dark' ? '#22c55e' : '#16a34a',
  },
  birthdayDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  pastBirthdayDot: {
    backgroundColor: colors.textSecondary,
  },
  selectedDateContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.muted,
    paddingTop: 12,
    marginTop: 12,
  },
  selectedDateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  birthdayList: {
    maxHeight: 150,
  },
  birthdayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
    marginBottom: 8,
  },
  pastBirthdayItem: {
    backgroundColor: theme === 'dark' ? 'rgba(107, 114, 128, 0.2)' : 'rgba(243, 244, 246, 1)',
    opacity: 0.75,
  },
  birthdayAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pastBirthdayAvatar: {
    backgroundColor: theme === 'dark' ? 'rgba(107, 114, 128, 0.3)' : 'rgba(229, 231, 235, 1)',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme === 'dark' ? '#22c55e' : '#16a34a',
  },
  birthdayInfo: {
    flex: 1,
  },
  birthdayUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  birthdayCountdown: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  noBirthdaysText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.muted,
    paddingTop: 12,
    marginTop: 12,
  },
  statsLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});

