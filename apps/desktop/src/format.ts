export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
export const date = (day: number) =>
  `Y${String(Math.floor(day / 365) + 1).padStart(2, '0')} · D${String((day % 365) + 1).padStart(3, '0')}`;
export const employmentLabels: Record<string, string> = {
  employed: '在職',
  unemployed: '求職中',
  retired: '退休',
  child: '未成年',
  student: '進修中',
};
export const policyLabels = {
  incomeTax: '所得稅率',
  corporateTax: '企業稅率',
  welfare: '每月福利給付',
  minimumWage: '每月最低工資',
  publicEducationFunding: '每生每月公共教育經費',
  vocationalFunding: '職訓每人每期經費',
  higherEducationSubsidy: '高等教育每生每月補助',
};
