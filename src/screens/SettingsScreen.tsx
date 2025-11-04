import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { colors } from '../theme/colors';
import { usePreferences } from '../state/preferences';
import { useI18n } from '../i18n';

const LANGS = [
  { key: 'en', label: 'English' },
  { key: 'ru', label: 'Русский' },
  { key: 'az', label: 'Azərbaycan' },
];

export const SettingsScreen: React.FC = () => {
  const { theme, language, setTheme, setLanguage } = usePreferences();
  const { t } = useI18n();
  const styles = React.useMemo(() => createStyles(), [theme]);

  useEffect(() => {}, [theme, language]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.theme')}</Text>
        <View style={styles.row}>
          <Text style={styles.text}>{t('settings.darkMode')}</Text>
          <Switch value={theme === 'dark'} onValueChange={(v) => setTheme(v ? 'dark' : 'light')} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        {LANGS.map(l => (
          <TouchableOpacity key={l.key} style={[styles.langRow, language === l.key && styles.langRowActive]} onPress={() => setLanguage(l.key as any)}>
            <Text style={[styles.text, language === l.key && styles.textActive]}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  section: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  text: { color: colors.text, fontSize: 16 },
  langRow: { paddingVertical: 10 },
  langRowActive: { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 9 },
  textActive: { color: colors.primary, fontWeight: '700' },
});


