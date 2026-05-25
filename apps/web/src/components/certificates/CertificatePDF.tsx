import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 300 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuBWYAZ9hiA.woff2', fontWeight: 700 },
  ],
});

Font.register({
  family: 'GreatVibes',
  src: 'https://fonts.gstatic.com/s/greatvibes/v19/RWmMoKWR9v4ksMfaWd_JN-XCg6VK.woff2',
});

const teal = '#00D9FF';
const green = '#00FF88';
const navy = '#0A1628';
const gold = '#D4AF37';
const gray = '#718096';

const styles = StyleSheet.create({
  page: {
    padding: 48,
    backgroundColor: '#ffffff',
    fontFamily: 'Inter',
  },
  border: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    border: '2px solid ' + gold,
    borderRadius: 4,
  },
  innerBorder: {
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    border: '1px solid ' + gold,
    borderRadius: 2,
  },
  header: {
    marginTop: 60,
    textAlign: 'center',
  },
  seal: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sealCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    border: '2px solid ' + gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealText: {
    fontSize: 8,
    color: navy,
    textAlign: 'center',
    lineHeight: 1.3,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  subtitle: {
    fontSize: 12,
    color: gray,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter',
    fontWeight: 700,
    color: navy,
    letterSpacing: 1,
    marginBottom: 4,
  },
  titleAccent: {
    color: teal,
  },
  presentedTo: {
    fontSize: 10,
    color: gray,
    marginTop: 24,
    marginBottom: 4,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  traderName: {
    fontSize: 36,
    fontFamily: 'GreatVibes',
    color: navy,
    marginBottom: 4,
  },
  divider: {
    width: 120,
    height: 1.5,
    backgroundColor: gold,
    marginVertical: 8,
  },
  description: {
    fontSize: 11,
    color: gray,
    textAlign: 'center',
    lineHeight: 1.6,
    maxWidth: 380,
  },
  accountSize: {
    fontSize: 18,
    fontFamily: 'Inter',
    fontWeight: 700,
    color: teal,
    marginVertical: 4,
  },
  details: {
    flexDirection: 'row',
    marginTop: 40,
    gap: 40,
  },
  detailCol: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 8,
    color: gray,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 12,
    color: navy,
    fontWeight: 600,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 20,
    borderTop: '1px solid ' + gray + '40',
  },
  signatureBlock: {
    alignItems: 'center',
    width: 160,
  },
  signatureLine: {
    width: '100%',
    height: 1,
    backgroundColor: navy,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: gray,
  },
  verification: {
    position: 'absolute',
    bottom: 44,
    left: 48,
    right: 48,
    textAlign: 'center',
  },
  verificationText: {
    fontSize: 7,
    color: gray,
  },
});

interface CertificatePDFProps {
  traderName: string;
  accountSize: number;
  certificateNumber: string;
  completionDate: string;
}

export function CertificatePDF({ traderName, accountSize, certificateNumber, completionDate }: CertificatePDFProps) {
  const formattedDate = new Date(completionDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.border} />
        <View style={styles.innerBorder} />

        <View style={styles.header}>
          <View style={styles.seal}>
            <View style={styles.sealCircle}>
              <Text style={styles.sealText}>TRIVARO{'\n'}PROP{'\n'}TRADING</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.subtitle}>Certificate of Completion</Text>
          <Text style={styles.title}>
            FUNDED<Text style={styles.titleAccent}> TRADER</Text>
          </Text>

          <Text style={styles.presentedTo}>Presented to</Text>
          <Text style={styles.traderName}>{traderName}</Text>

          <View style={styles.divider} />

          <Text style={styles.description}>
            This certifies that the above trader has successfully completed the
            Trivaro evaluation program and demonstrated consistent profitability,
            risk management, and trading discipline.
          </Text>

          <Text style={styles.accountSize}>
            ${(accountSize / 1000).toFixed(0)},000 Account
          </Text>

          <View style={styles.details}>
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>Certificate No.</Text>
              <Text style={styles.detailValue}>{certificateNumber}</Text>
            </View>
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>Date Issued</Text>
              <Text style={styles.detailValue}>{formattedDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Authorized Signature</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Trivaro Management</Text>
          </View>
        </View>

        <View style={styles.verification}>
          <Text style={styles.verificationText}>
            Verify at trivaro.com/verify · {certificateNumber}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
