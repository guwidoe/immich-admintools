import { Controller, Get, Patch, Body } from '@nestjs/common';
import { SettingsService, AppSettings, UpdateSettingsInput } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings(): AppSettings {
    return this.settingsService.getSettings();
  }

  @Patch()
  async updateSettings(@Body() updates: UpdateSettingsInput): Promise<AppSettings> {
    return this.settingsService.updateSettings(updates);
  }
}
