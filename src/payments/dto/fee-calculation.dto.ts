export interface FeeCalculationResult {
  totalAmount: number;
  gatewayFee: number;
  cargoFee: number;
  rewardAmount: number;
  serviceFee: number;
  netPayout: number;
}

export class FeeCalculationDto {
  totalAmount: number;
  gatewayFee: number;
  cargoFee: number;
  rewardAmount: number;
  serviceFee: number;
  netPayout: number;

  constructor(result: FeeCalculationResult) {
    this.totalAmount = result.totalAmount;
    this.gatewayFee = result.gatewayFee;
    this.cargoFee = result.cargoFee;
    this.rewardAmount = result.rewardAmount;
    this.serviceFee = result.serviceFee;
    this.netPayout = result.netPayout;
  }
}

