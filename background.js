'use strict';

const ports = [];
chrome.runtime.onConnect.addListener(port => {
  const index = ports.push(port) - 1;
  port.onDisconnect.addListener(() => {
    ports.splice(index, 1);
  });
});

const find = () => new Promise((resolve, reject) => {
  if (ports.length) {
    return resolve(ports[0].sender.tab);
  }
  reject(Error('no window'));
});

const onCommand = (options = {}) => find().then(tab => {
  chrome.windows.update(tab.windowId, {
    focused: true
  });
  chrome.tabs.update(tab.id, {
    highlighted: true
  });
  return tab;
}).catch(() => new Promise(resolve => chrome.storage.local.get({
  'width': 800,
  'height': 500,
  'left': screen.availLeft + Math.round((screen.availWidth - 800) / 2),
  'top': screen.availTop + Math.round((screen.availHeight - 500) / 2),
  'open-in-tab': false
}, prefs => {
  const args = new URLSearchParams();
  if (options.src) {
    args.set('src', options.src);
  }
  args.set('mode', prefs['open-in-tab'] ? 'tab' : 'window');

  const url = 'data/player/index.html?' + args.toString();
  if (prefs['open-in-tab']) {
    chrome.tabs.create({
      url
    }, resolve);
  }
  else {
    delete prefs['open-in-tab'];
    chrome.windows.create(Object.assign(prefs, {
      url,
      type: 'popup'
    }), w => resolve(w.tabs[0]));
  }
})));

chrome.browserAction.onClicked.addListener(onCommand);

const notify = message => chrome.notifications.create(null, {
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: 'Media Player',
  message
});

window.save = prefs => {
  chrome.storage.local.set(prefs);
};

// context-menu
(callback => {
  chrome.runtime.onInstalled.addListener(callback);
  chrome.runtime.onStartup.addListener(callback);
})(() => {
  chrome.contextMenus.create({
    id: 'open-src',
    title: 'Open in Media Player',
    contexts: ['video', 'audio']
  });
  chrome.contextMenus.create({
    title: 'Play with Video Player',
    id: 'play-link',
    contexts: ['link'],
    targetUrlPatterns: [
      'avi', 'mp4', 'webm', 'flv', 'mov', 'ogv', '3gp', 'mpg', 'wmv', 'swf', 'mkv',
      'pcm', 'wav', 'aac', 'ogg', 'wma', 'flac', 'mid', 'mka', 'm4a', 'voc', 'm3u8'
    ].map(a => '*://*/*.' + a)
  });
  chrome.contextMenus.create({
    id: 'previous-track',
    title: 'Previous track',
    contexts: ['browser_action']
  });
  chrome.contextMenus.create({
    id: 'next-track',
    title: 'Next track',
    contexts: ['browser_action']
  });
  chrome.contextMenus.create({
    id: 'toggle-play',
    title: 'Toggle play/pause',
    contexts: ['browser_action']
  });
  chrome.contextMenus.create({
    id: 'test-audio',
    title: 'Test Playback',
    contexts: ['browser_action']
  });
  chrome.storage.local.get({
    'open-in-tab': false
  }, prefs => {
    chrome.contextMenus.create({
      id: 'open-in-tab',
      title: 'Open Player in Tab',
      contexts: ['browser_action'],
      type: 'checkbox',
      checked: prefs['open-in-tab']
    });
  });
});
chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === 'open-in-tab') {
    chrome.storage.local.set({
      'open-in-tab': info.checked
    });
  }
  else if (info.menuItemId === 'test-audio') {
    chrome.tabs.create({
      url: 'https://webbrowsertools.com/audio-test/'
    });
  }
  else if (info.menuItemId === 'open-src') {
    onCommand({
      src: info.srcUrl
    }).then(t => chrome.tabs.sendMessage(t.id, {
      method: 'open-src',
      src: info.srcUrl
    }));
  }
  else if (info.menuItemId === 'play-link') {
    onCommand({
      src: info.linkUrl
    }).then(t => chrome.tabs.sendMessage(t.id, {
      method: 'open-src',
      src: info.linkUrl
    }));
  }
  else {
    find().then(t => chrome.tabs.sendMessage(t.id, {
      method: info.menuItemId
    })).catch(() => notify('Please open "Media Player" and retry'));
  }
});
chrome.commands.onCommand.addListener(method => find().then(t => chrome.tabs.sendMessage(t.id, {
  method
})).catch(() => notify('Please open "Media Player" and retry')));

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install'
            });
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
