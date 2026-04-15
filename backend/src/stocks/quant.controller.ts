import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { QuantService } from '../intelligence/quant.service';

@ApiTags('Quant')
@Controller('quant')
export class QuantController {
  constructor(private readonly quantService: QuantService) {}

  @Get('top-signals')
  @ApiOperation({
    summary: 'Top 10 stocks ranked by QuantScore',
    description: 'Returns the top 10 stocks with the highest QuantScore (0–100), along with their signal (BUY/SELL/HOLD) and key indicators.',
  })
  getTopSignals() {
    return this.quantService.getTopSignals(10);
  }

  @Get('all-signals')
  @ApiOperation({
    summary: 'QuantScore for all tracked stocks',
    description: 'Returns the latest QuantScore and signal for every tracked stock. Returns null for stocks with insufficient price history.',
  })
  getAllSignals() {
    return this.quantService.getAllSignals();
  }
}
