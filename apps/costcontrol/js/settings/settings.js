/* global LazyLoader, AutoSettings,
          ViewManager, dataLimitConfigurer, PerformanceTestingHelper
*/
/* exported debug, sendBalanceThresholdNotification */
/*
 * Settings is in charge of setup the setting section. It uses an AutoSettings
 * object to automatically bind markup with local settings.
 *
 * Settings have three drawing areas with views for current values of balance,
 * data usage and telephony.
 */
'use strict';
// Import global objects from parent window
var ConfigManager = window.parent.ConfigManager;
var CostControl = window.parent.CostControl;
var SimManager = window.parent.SimManager;
var Common = window.parent.Common;
var NetworkUsageAlarm = window.parent.NetworkUsageAlarm;

// Import global functions from parent window
var addNetworkUsageAlarm = window.parent.addNetworkUsageAlarm;
var _ = window.parent._;
navigator.mozL10n = window.parent.navigator.mozL10n;

var debug = window.parent.debug;

var Settings = (function() {

  var costcontrol, vmanager, initialized, endLoadSettingsNotified;

  function configureUI() {
    CostControl.getInstance(function _onCostControl(instance) {
      costcontrol = instance;

      // Autosettings
      vmanager = new ViewManager();
      AutoSettings.addType('data-limit', dataLimitConfigurer);
      AutoSettings.initialize(ConfigManager, vmanager, '#settings-view');

      // Add an observer on dataLimit switch to active o deactivate alarms
      ConfigManager.observe(
        'dataLimit',
        function _onDataLimitChange(value, old, key, settings) {
          SimManager.requestDataSimIcc(function(dataSim) {
            var iccId = dataSim.iccId;
            var currentDataInterface = Common.getDataSIMInterface(iccId);
            if (!value) {
              NetworkUsageAlarm.clearAlarms(currentDataInterface);
            } else {
              addNetworkUsageAlarm(currentDataInterface,
                                   Common.getDataLimit(settings));
            }
          });
        },
        true
      );

      // Update layout when changing plantype
      ConfigManager.observe('plantype', updateUI, true);

      // Close button needs to acquire a reference to the settings view
      // manager to close itself.
      var close = document.getElementById('close-settings');
      close.addEventListener('click', function() {
        closeSettings();
      });

      function _setResetTimeToDefault(value, old, key, settings) {
        var firstWeekDay = parseInt(_('weekStartsOnMonday'), 10);
        var defaultResetTime = (settings.trackingPeriod === 'weekly') ?
                                                                  firstWeekDay :
                                                                  1;
        if (settings.resetTime !== defaultResetTime) {
          ConfigManager.setOption({ resetTime: defaultResetTime });
        } else {
          Common.updateNextReset(settings.trackingPeriod, settings.resetTime);
        }
      }

      function _updateNextReset(value, old, key, settings) {
        Common.updateNextReset(settings.trackingPeriod, settings.resetTime);
      }

      ConfigManager.observe('resetTime', _updateNextReset, true);
      ConfigManager.observe('trackingPeriod', _setResetTimeToDefault, true);

      initialized = true;

      Settings.updateUI();
    });
  }

  function closeSettings() {
    window.parent.location.hash = '#';
  }

  window.addEventListener('localized', function _onLocalize() {
    if (initialized) {
      updateUI();
    }
  });

  var currentMode;
  function updateUI() {
    ConfigManager.requestAll(function _onInfo(configuration, settings) {
      // L10n
      Common.localizeWeekdaySelector(
        document.getElementById('select-weekday'));

      // Layout
      var mode = ConfigManager.getApplicationMode();
      if (currentMode !== mode) {
        currentMode = mode;
      }

      if (endLoadSettingsNotified) {
        PerformanceTestingHelper.dispatch('end-load-settings');
        endLoadSettingsNotified = true;
      }
    });
  }

  return {
    initialize: function() {
      var SCRIPTS_NEEDED = [
        'js/utils/toolkit.js',
        'js/utils/formatting.js',
        'js/settings/limitdialog.js',
        'js/settings/autosettings.js',
        'js/view_manager.js'
      ];
      LazyLoader.load(SCRIPTS_NEEDED, function() {
        if (!Common.allNetworkInterfaceLoaded) {
          Common.loadNetworkInterfaces(configureUI);
        } else {
          configureUI();
        }
      });
    },
    updateUI: updateUI
  };

}());

Settings.initialize();
