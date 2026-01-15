import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface JobThresholds {
  default: number;
  faceDetection: number;
  facialRecognition: number;
  thumbnailGeneration: number;
  metadataExtraction: number;
  videoConversion: number;
}

export interface AutoHealSettings {
  enabled: boolean;
  intervalSeconds: number;
}

export interface AppSettings {
  thresholds: JobThresholds;
  autoHeal: AutoHealSettings;
  excludedQueues: string[];
}

export interface UpdateSettingsInput {
  thresholds?: Partial<JobThresholds>;
  autoHeal?: Partial<AutoHealSettings>;
  excludedQueues?: string[];
}

@Injectable()
export class SettingsService implements OnModuleInit {
  private settings: AppSettings;
  private readonly settingsFilePath: string;

  constructor(private readonly configService: ConfigService) {
    this.settingsFilePath = path.join(process.cwd(), 'data', 'settings.json');

    // Initialize with defaults from config/env
    this.settings = this.getDefaultSettings();
  }

  async onModuleInit() {
    await this.loadSettings();
  }

  private getDefaultSettings(): AppSettings {
    return {
      thresholds: {
        default: this.configService.get<number>('autoHeal.thresholds.default', 300),
        faceDetection: this.configService.get<number>('autoHeal.thresholds.faceDetection', 300),
        facialRecognition: this.configService.get<number>('autoHeal.thresholds.facialRecognition', 300),
        thumbnailGeneration: this.configService.get<number>('autoHeal.thresholds.thumbnailGeneration', 120),
        metadataExtraction: this.configService.get<number>('autoHeal.thresholds.metadataExtraction', 180),
        videoConversion: this.configService.get<number>('autoHeal.thresholds.videoConversion', 1800),
      },
      autoHeal: {
        enabled: this.configService.get<boolean>('autoHeal.enabled', false),
        intervalSeconds: this.configService.get<number>('autoHeal.checkIntervalSeconds', 60),
      },
      excludedQueues: this.configService.get<string[]>('autoHeal.excludedQueues', ['backupDatabase', 'library']),
    };
  }

  private async loadSettings(): Promise<void> {
    try {
      if (fs.existsSync(this.settingsFilePath)) {
        const data = fs.readFileSync(this.settingsFilePath, 'utf-8');
        const savedSettings = JSON.parse(data) as Partial<AppSettings>;

        // Merge saved settings with defaults (saved takes precedence)
        this.settings = {
          thresholds: { ...this.settings.thresholds, ...savedSettings.thresholds },
          autoHeal: { ...this.settings.autoHeal, ...savedSettings.autoHeal },
          excludedQueues: savedSettings.excludedQueues ?? this.settings.excludedQueues,
        };

        console.log('[SettingsService] Loaded settings from file');
      }
    } catch (error) {
      console.warn('[SettingsService] Could not load settings file, using defaults:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      const dir = path.dirname(this.settingsFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.settingsFilePath, JSON.stringify(this.settings, null, 2));
      console.log('[SettingsService] Settings saved to file');
    } catch (error) {
      console.error('[SettingsService] Could not save settings file:', error);
    }
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  getThresholds(): JobThresholds {
    return { ...this.settings.thresholds };
  }

  getAutoHeal(): AutoHealSettings {
    return { ...this.settings.autoHeal };
  }

  getExcludedQueues(): string[] {
    return [...this.settings.excludedQueues];
  }

  getThresholdForQueue(queueName: string): number {
    // Convert queue name to threshold key (e.g., 'face-detection' -> 'faceDetection')
    const normalizedName = queueName
      .split('-')
      .map((part, index) =>
        index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
      )
      .join('') as keyof JobThresholds;

    return this.settings.thresholds[normalizedName] ?? this.settings.thresholds.default;
  }

  isQueueExcluded(queueName: string): boolean {
    return this.settings.excludedQueues.includes(queueName);
  }

  async updateThresholds(thresholds: Partial<JobThresholds>): Promise<JobThresholds> {
    this.settings.thresholds = { ...this.settings.thresholds, ...thresholds };
    await this.saveSettings();
    return this.getThresholds();
  }

  async updateAutoHeal(autoHeal: Partial<AutoHealSettings>): Promise<AutoHealSettings> {
    this.settings.autoHeal = { ...this.settings.autoHeal, ...autoHeal };
    await this.saveSettings();
    return this.getAutoHeal();
  }

  async updateExcludedQueues(queues: string[]): Promise<string[]> {
    this.settings.excludedQueues = queues;
    await this.saveSettings();
    return this.getExcludedQueues();
  }

  async updateSettings(updates: UpdateSettingsInput): Promise<AppSettings> {
    if (updates.thresholds) {
      this.settings.thresholds = { ...this.settings.thresholds, ...updates.thresholds };
    }
    if (updates.autoHeal) {
      this.settings.autoHeal = { ...this.settings.autoHeal, ...updates.autoHeal };
    }
    if (updates.excludedQueues) {
      this.settings.excludedQueues = updates.excludedQueues;
    }
    await this.saveSettings();
    return this.getSettings();
  }
}
