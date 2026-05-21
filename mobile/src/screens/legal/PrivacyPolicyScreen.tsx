import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemeTokens } from '../../context/ThemeContext';

export function PrivacyPolicyScreen() {
  const { c } = useThemeTokens();
  const updated = new Date().toLocaleDateString('ru-RU');

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={[styles.h2, { color: c.heading }]}>{title}</Text>
      {children}
    </View>
  );

  const Bullet = ({ label }: { label: string }) => (
    <Text style={[styles.li, { color: c.text }]}>• {label}</Text>
  );

  const P = ({ children }: { children: React.ReactNode }) => (
    <Text style={[styles.p, { color: c.text }]}>{children}</Text>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.appBg }} contentContainerStyle={styles.pad}>
      <Text style={[styles.h1, { color: c.heading }]}>Политика обработки персональных данных</Text>

      <Section title="1. Общие положения">
        <P>
          Настоящая политика обработки персональных данных составлена в соответствии с требованиями
          Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» и определяет порядок
          обработки персональных данных и меры по обеспечению безопасности персональных данных в
          Магазине мерча.
        </P>
      </Section>

      <Section title="2. Какие данные мы обрабатываем">
        <Bullet label="Фамилия, имя, отчество" />
        <Bullet label="Адрес электронной почты" />
        <Bullet label="Номер телефона" />
        <Bullet label="Данные о заказах и покупках" />
        <Bullet label="История взаимодействия с сайтом и приложением" />
      </Section>

      <Section title="3. Цели обработки данных">
        <Bullet label="Регистрация пользователя" />
        <Bullet label="Оформление и обработка заказов" />
        <Bullet label="Обеспечение связи с пользователем" />
        <Bullet label="Отправка уведомлений о статусе заказов" />
        <Bullet label="Улучшение качества обслуживания" />
      </Section>

      <Section title="4. Срок хранения данных">
        <P>
          Персональные данные пользователей хранятся в течение срока, необходимого для достижения
          целей обработки, но не более 5 лет с момента последнего взаимодействия пользователя с
          сервисом.
        </P>
      </Section>

      <Section title="5. Меры защиты данных">
        <P>Мы применяем следующие меры защиты персональных данных:</P>
        <Bullet label="Шифрование конфиденциальных данных при хранении" />
        <Bullet label="Ограничение доступа к персональным данным" />
        <Bullet label="Регулярное обновление систем защиты" />
        <Bullet label="Обучение сотрудников правилам работы с персональными данными" />
      </Section>

      <Section title="6. Права пользователей">
        <P>Пользователь имеет право:</P>
        <Bullet label="Получать информацию об обработке своих персональных данных" />
        <Bullet label="Требовать уточнения, блокировки или уничтожения данных" />
        <Bullet label="Отзывать согласие на обработку данных" />
        <Bullet label="Обжаловать действия оператора в уполномоченный орган" />
      </Section>

      <Section title="7. Контактная информация">
        <P>
          {[
            'По вопросам обработки персональных данных обращайтесь:',
            'Email: privacy@mpt.ru',
            'Телефон: +7 (495) 123-45-67',
          ].join('\n')}
        </P>
      </Section>

      <Text style={[styles.date, { color: c.muted }]}>
        <Text style={{ fontWeight: '700' }}>Дата последнего обновления: </Text>
        {updated}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 48 },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 18 },
  section: { marginBottom: 20 },
  h2: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  p: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  li: { fontSize: 15, lineHeight: 24, marginLeft: 4 },
  date: { fontSize: 13, marginTop: 8 },
});
