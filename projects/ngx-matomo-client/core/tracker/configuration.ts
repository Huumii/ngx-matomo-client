import { inject, InjectionToken } from '@angular/core';
import { requireNonNull } from '../utils/coercion';

const CONFIG_NOT_FOUND =
  'No Matomo configuration found! Have you included Matomo module using MatomoModule.forRoot() or provideMatomo()?';

/** Internal marker token to detect that router has been enabled */
export const MATOMO_ROUTER_ENABLED = new InjectionToken<boolean>('MATOMO_ROUTER_ENABLED', {
  factory() {
    return false;
  },
});

/** Injection token for {@link MatomoConfiguration} */
export const MATOMO_CONFIGURATION = new InjectionToken<MatomoConfiguration>('MATOMO_CONFIGURATION');

/**
 * For internal use only. Injection token for {@link InternalMatomoConfiguration}
 *
 */
export const INTERNAL_MATOMO_CONFIGURATION = new InjectionToken<InternalMatomoConfiguration>(
  'INTERNAL_MATOMO_CONFIGURATION',
);

export function createInternalMatomoConfiguration(): InternalMatomoConfiguration {
  const { mode, requireConsent, ...restConfig } = requireNonNull(
    inject(MATOMO_CONFIGURATION, { optional: true }),
    CONFIG_NOT_FOUND,
  );

  return {
    mode: mode ? coerceInitializationMode(mode) : undefined,
    disabled: false,
    enableLinkTracking: true,
    trackAppInitialLoad: !inject(MATOMO_ROUTER_ENABLED),
    requireConsent: requireConsent ? coerceConsentRequirement(requireConsent) : 'none',
    enableJSErrorTracking: false,
    runOutsideAngularZone: false,
    disableCampaignParameters: false,
    acceptDoNotTrack: false,
    ...restConfig,
  };
}

/**
 * For internal use only. Injection token for deferred {@link InternalMatomoConfiguration}.
 *
 */
export const DEFERRED_INTERNAL_MATOMO_CONFIGURATION =
  new InjectionToken<DeferredInternalMatomoConfiguration>('DEFERRED_INTERNAL_MATOMO_CONFIGURATION');

export function createDeferredInternalMatomoConfiguration(): DeferredInternalMatomoConfiguration {
  const base = inject(INTERNAL_MATOMO_CONFIGURATION);
  let resolveFn: ((configuration: InternalMatomoConfiguration) => void) | undefined;
  const configuration = new Promise<InternalMatomoConfiguration>(resolve => (resolveFn = resolve));

  return {
    configuration,
    markReady(configuration) {
      requireNonNull(
        resolveFn,
        'resolveFn',
      )({
        ...base,
        ...configuration,
      });
    },
  };
}

/**
 * For internal use only. Injection token for fully loaded async {@link InternalMatomoConfiguration}.
 *
 */
export const ASYNC_INTERNAL_MATOMO_CONFIGURATION = new InjectionToken<
  Promise<InternalMatomoConfiguration>
>('ASYNC_INTERNAL_MATOMO_CONFIGURATION');

/**
 * For internal use only. Module configuration merged with default values.
 *
 */
export type InternalMatomoConfiguration = Omit<MatomoConfiguration, 'mode' | 'requireConsent'> &
  Omit<Required<BaseMatomoConfiguration>, 'requireConsent'> & {
    mode?: MatomoInitializationBehavior;
    requireConsent: MatomoConsentRequirement;
  };

export interface DeferredInternalMatomoConfiguration {
  readonly configuration: Promise<InternalMatomoConfiguration>;

  markReady(configuration: InternalMatomoConfiguration): void;
}

/**
 * - __auto__: automatically inject matomo script using provided configuration
 * - __manual__: do not inject Matomo script. In this case, initialization script must be provided
 * - __deferred__: automatically inject matomo script when deferred tracker configuration is provided using `MatomoInitializerService.initializeTracker()`.
 */
export type MatomoInitializationBehavior = 'auto' | 'manual' | 'deferred';

/** @deprecated Use {@link MatomoInitializationBehavior} instead */
export enum MatomoInitializationMode {
  /**
   * Automatically inject matomo script using provided configuration
   *
   * @deprecated Use `'auto'` instead
   */
  AUTO,
  /**
   * Do not inject Matomo script. In this case, initialization script must be provided
   *
   * @deprecated Use `'manual'` instead
   */
  MANUAL,
  /**
   * Automatically inject matomo script when deferred tracker configuration is provided using `MatomoInitializerService.initializeTracker()`.
   *
   * @deprecated Use `'deferred'` instead
   */
  AUTO_DEFERRED,
}

export function coerceInitializationMode(
  value: MatomoInitializationBehaviorInput,
): MatomoInitializationBehavior {
  switch (value) {
    case MatomoInitializationMode.AUTO:
      return 'auto';
    case MatomoInitializationMode.MANUAL:
      return 'manual';
    case MatomoInitializationMode.AUTO_DEFERRED:
      return 'deferred';
    default:
      return value;
  }
}

export type MatomoConsentRequirement = 'none' | 'cookie' | 'tracking';

/** @deprecated Use {@link MatomoConsentRequirement} instead */
export enum MatomoConsentMode {
  /** Do not require any consent, always track users */
  NONE,
  /** Require cookie consent */
  COOKIE,
  /** Require tracking consent */
  TRACKING,
}

export function coerceConsentRequirement(
  value: MatomoConsentMode | MatomoConsentRequirement,
): MatomoConsentRequirement {
  switch (value) {
    case MatomoConsentMode.NONE:
      return 'none';
    case MatomoConsentMode.COOKIE:
      return 'cookie';
    case MatomoConsentMode.TRACKING:
      return 'tracking';
    default:
      return value;
  }
}

export interface MatomoTrackerConfiguration {
  /** Matomo site id */
  siteId: number | string;

  /** Matomo server url */
  trackerUrl: string;

  /** The trackerUrlSuffix is always appended to the trackerUrl. It defaults to matomo.php */
  trackerUrlSuffix?: string;
}

export interface MultiTrackersConfiguration {
  /**
   * Configure multiple tracking servers. <b>Order matters: if no custom script url is
   * provided, Matomo script will be downloaded from first tracker.</b>
   */
  trackers: MatomoTrackerConfiguration[];
}

export interface BaseMatomoConfiguration {
  /** Set to `true` to disable tracking */
  disabled?: boolean;

  /** If `true`, track a page view when app loads (default `false`) */
  trackAppInitialLoad?: boolean;

  /**
   * Configure link clicks tracking
   *
   * If `true` (the default value), enable link tracking, excluding middle-clicks and contextmenu events.
   * If `enable-pseudo`, enable link tracking, including middle-clicks and contextmenu events.
   * If `false`, to disable this Matomo feature (default `true`).
   *
   * Used when {@link trackAppInitialLoad} is `true` and when automatic page tracking is enabled.
   *
   * @see {@link MatomoTracker.enableLinkTracking} for more details
   */
  enableLinkTracking?: boolean | 'enable-pseudo';

  /** Set to `true` to not track users who opt out of tracking using <i>Do Not Track</i> setting */
  acceptDoNotTrack?: boolean;

  /**
   * Configure user consent requirement
   *
   * To identify whether you need to ask for any consent, you need to determine whether your lawful
   * basis for processing personal data is "Consent" or "Legitimate interest", or whether you can
   * avoid collecting personal data altogether.
   *
   * Matomo differentiates between cookie and tracking consent:
   * - In the context of <b>tracking consent</b> no cookies will be used and no tracking request
   *   will be sent unless consent was given. As soon as consent was given, tracking requests will
   *   be sent and cookies will be used.
   * - In the context of <b>cookie consent</b> tracking requests will always be sent. However,
   *   cookies will be only used if consent for storing and using cookies was given by the user.
   *
   * Note that cookies impact reports accuracy.
   *
   * See Matomo guide: {@link https://developer.matomo.org/guides/tracking-consent}
   */
  requireConsent?: MatomoConsentRequirement | MatomoConsentMode;

  /** Set to `true` to enable Javascript errors tracking as <i>events</i> (with category <i>JavaScript Errors</i>) */
  enableJSErrorTracking?: boolean;

  /** Set to `true` to run matomo calls outside of angular NgZone. This may fix angular freezes. This has no effect in zoneless applications. */
  runOutsideAngularZone?: boolean;

  /**
   * Set to `true` to avoid sending campaign parameters
   *
   * By default, Matomo will send campaign parameters (mtm, utm, etc.) to the tracker and record that information.
   * Some privacy regulations may not allow for this information to be collected.
   *
   * <b>This is available as of Matomo 5.1 only.</b>
   */
  disableCampaignParameters?: boolean;
}

/**
 * Mapping type to extend input types with legacy `MatomoInitializationMode` type
 *
 * TODO remove when `MatomoInitializationMode` is removed
 */
export interface MatomoInitializationBehaviorInputMapping {
  manual: MatomoInitializationMode.MANUAL;
  auto: MatomoInitializationMode.AUTO;
  deferred: MatomoInitializationMode.AUTO_DEFERRED;
}

/**
 * Special type to map a `MatomoInitializationBehavior` to either itself or the legacy equivalent `MatomoInitializationMode`
 *
 * @example
 * MatomoInitializationBehaviorInput<'auto'>
 *   // Equivalent to:
 * 'auto' | MatomoInitializationMode.AUTO
 *
 * MatomoInitializationBehaviorInput<'manual'>
 *   // Equivalent to:
 * 'manual' | MatomoInitializationMode.MANUAL
 *
 * MatomoInitializationBehaviorInput<'deferred'>
 *   // Equivalent to:
 * 'deferred' | MatomoInitializationMode.AUTO_DEFERRED
 *
 * TODO remove when `MatomoInitializationMode` is removed and use `MatomoInitializationBehavior` instead
 */
export type MatomoInitializationBehaviorInput<
  T extends MatomoInitializationBehavior = MatomoInitializationBehavior,
> = T | MatomoInitializationBehaviorInputMapping[T];

export interface BaseAutoMatomoConfiguration<M extends 'auto' | 'deferred' = 'auto'> {
  /**
   * Set the script initialization mode (default is `'auto'`)
   *
   * @see MatomoInitializationBehavior
   */
  mode?: MatomoInitializationBehaviorInput<M>;

  /** Matomo script url (default is `matomo.js` appended to main tracker url) */
  scriptUrl: string;
}

type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;
type XOR3<T, U, V> = XOR<T, XOR<U, V>>;

export type ManualMatomoConfiguration = {
  /**
   * Set the script initialization mode (default is `'auto'`)
   *
   * @see MatomoInitializationBehavior
   */
  mode: MatomoInitializationBehaviorInput<'manual'>;
};

export type DeferredMatomoConfiguration = {
  /**
   * Set the script initialization mode (default is `'auto'`)
   *
   * @see MatomoInitializationBehavior
   */
  mode: MatomoInitializationBehaviorInput<'deferred'>;
};

export type ExplicitAutoConfiguration<M extends 'auto' | 'deferred' = 'auto'> = Partial<
  BaseAutoMatomoConfiguration<M>
> &
  XOR<MatomoTrackerConfiguration, MultiTrackersConfiguration>;

export type EmbeddedAutoConfiguration<M extends 'auto' | 'deferred' = 'auto'> =
  BaseAutoMatomoConfiguration<M> & Partial<MultiTrackersConfiguration>;

export type AutoMatomoConfiguration<M extends 'auto' | 'deferred' = 'auto'> = XOR<
  ExplicitAutoConfiguration<M>,
  EmbeddedAutoConfiguration<M>
>;

export type MatomoConfiguration = BaseMatomoConfiguration &
  XOR3<AutoMatomoConfiguration, ManualMatomoConfiguration, DeferredMatomoConfiguration>;

export function isAutoConfigurationMode(
  config: MatomoConfiguration | InternalMatomoConfiguration,
): config is AutoMatomoConfiguration {
  return (
    config.mode == null || config.mode === 'auto' || config.mode === MatomoInitializationMode.AUTO
  );
}

function hasMainTrackerConfiguration<M extends 'auto' | 'deferred'>(
  config: AutoMatomoConfiguration<M>,
): config is ExplicitAutoConfiguration<M> {
  // If one is undefined, both should be
  return config.siteId != null && config.trackerUrl != null;
}

export function isEmbeddedTrackerConfiguration<M extends 'auto' | 'deferred'>(
  config: AutoMatomoConfiguration<M>,
): config is EmbeddedAutoConfiguration<M> {
  return config.scriptUrl != null && !hasMainTrackerConfiguration(config);
}

export function isExplicitTrackerConfiguration<M extends 'auto' | 'deferred'>(
  config: AutoMatomoConfiguration<M>,
): config is ExplicitAutoConfiguration<M> {
  return hasMainTrackerConfiguration(config) || isMultiTrackerConfiguration(config);
}

export function isMultiTrackerConfiguration(
  config: AutoMatomoConfiguration<'auto' | 'deferred'>,
): config is MultiTrackersConfiguration {
  return Array.isArray(config.trackers);
}

export function getTrackersConfiguration(
  config: ExplicitAutoConfiguration<'auto' | 'deferred'>,
): MatomoTrackerConfiguration[] {
  return isMultiTrackerConfiguration(config)
    ? config.trackers
    : [
        {
          trackerUrl: config.trackerUrl,
          siteId: config.siteId,
          trackerUrlSuffix: config.trackerUrlSuffix,
        },
      ];
}
