import Http from "axios";
import kjua from "kjua";
import config from "./config";
import images from "./assets/images.json";

class AuthArmorSDK {
  constructor(url) {
    this.url = this._processUrl(url);
    Http.defaults.baseURL = this.url;

    // Supported events
    this.events = [
      "authenticating",
      "authenticated",
      "inviteWindowOpened",
      "inviteWindowClosed",
      "popupOverlayOpen",
      "popupOverlayClosed",
      "inviteAccepted",
      "inviteDeclined",
      "inviteCancelled"
    ];
    this.eventListeners = new Map(
      this.events.reduce(
        (eventListeners, eventName) => ({
          ...eventListeners,
          [eventName]: []
        }),
        {}
      )
    );

    this.inviteCode = "";
    this.signature = "";
    this._init = this._init.bind(this);
    this._init();
  }

  // Private Methods

  _processUrl(url = "") {
    const lastCharacter = url.slice(-1);
    const containsSlash = lastCharacter === "/";
    if (containsSlash) {
      return url.slice(0, url.length - 1);
    }

    return url;
  }

  _ensureEventExists(eventName) {
    if (!this.events.includes(eventName)) {
      throw new Error("Event doesn't exist");
    }
  }

  _popupWindow(url, title, w, h) {
    const y = window.outerHeight / 2 + window.screenY - h / 2;
    const x = window.outerWidth / 2 + window.screenX - w / 2;
    const openedWindow = window.open(
      url,
      title,
      `toolbar=no, 
      location=no, 
      directories=no, 
      status=no, 
      menubar=no, 
      scrollbars=no, 
      resizable=no, 
      copyhistory=no, 
      width=${w}, 
      height=${h}, 
      top=${y}, 
      left=${x}`
    );
    this._executeEvent("inviteWindowOpened");
    const interval = setInterval(function() {
      if (openedWindow.closed) {
        clearInterval(interval);
        window.closedWindow();
      }
    }, 500);
  }

  _showPopup(message = "Waiting for device") {
    document.querySelector(".popup-overlay").classList.remove("hidden");
    document.querySelector(".auth-message").textContent = message;
    this._executeEvent("popupOverlayOpened");
  }

  _hidePopup(delay = 500) {
    setTimeout(() => {
      document.querySelector(".popup-overlay").classList.add("hidden");
      document
        .querySelector(".auth-message")
        .setAttribute("class", "auth-message");
      document.querySelector(".auth-message").textContent =
        "Waiting for device";
      this._executeEvent("popupOverlayClosed");
    }, delay);
  }

  _updateMessage(message, status = "success") {
    document
      .querySelector(".auth-message")
      .classList.add(`autharmor--${status}`);
    document.querySelector(".auth-message").textContent = message;
  }

  _executeEvent(eventName, ...data) {
    this._ensureEventExists(eventName);

    const listeners = this.eventListeners.get(eventName);
    listeners.map(listener => listener(...data));
  }

  _init() {
    document.body.innerHTML += `
      <style>
        .popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background-color: rgba(53, 57, 64, 0.98);
          z-index: 100;
          opacity: 1;
          visibility: visible;
          transition: all .2s ease;
        }
        
        .popup-overlay-content {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border-radius: 15px;
          overflow: hidden;
          box-shadow: 0px 20px 50px rgba(0, 0, 0, 0.15);
          background-color: #2b313c;
        }
        
        .popup-overlay img {
          height: 110px;
          margin-bottom: 40px;
          margin-top: 40px;
        }
        
        .popup-overlay p {
          margin: 0;
          font-weight: bold;
          color: white;
          font-size: 18px;
          padding: 14px 80px;
          background-color: rgb(0, 128, 128);
        }

        .hidden {
          opacity: 0;
          visibility: hidden;
        }
      </style>
      <div class="popup-overlay hidden">
        <div class="popup-overlay-content">
          <img src="${images.logo}" alt="AuthArmor Icon" />
          <p class="auth-message">Authenticating with AuthArmor...</p>
        </div>
      </div>
    `;

    window.openedWindow = () => {
      this._executeEvent("inviteWindowOpened");
      this._showPopup();
    };

    window.AUTHARMOR_acceptRequest = data => {
      this._executeEvent("inviteAccepted", data);
      if (data) {
        this._updateMessage(data.message);
      }
      this._hidePopup();
    };

    window.AUTHARMOR_cancelRequest = data => {
      this._executeEvent("inviteCancelled", data);
      if (data) {
        this._updateMessage(data.message, "danger");
      }
      this._hidePopup();
    };

    window.AUTHARMOR_error = data => {
      this._executeEvent("error", data);
      if (data) {
        this._updateMessage(data.message, "danger");
      }
      this._hidePopup();
    };

    window.closedWindow = () => {
      this._executeEvent("inviteWindowClosed");
      this._hidePopup();
    };
  }

  // ---- Public Methods

  // -- Event Listener functions

  on(eventName, fn) {
    this._ensureEventExists(eventName);

    const listeners = this.eventListeners.get(eventName);
    this.eventListeners.set(eventName, [...listeners, fn]);
  }

  off(eventName) {
    this._ensureEventExists(eventName);

    this.eventListeners.set(eventName, []);
  }

  // -- Invite functionality

  setInviteData({ inviteCode, signature } = {}) {
    if (!inviteCode || !signature) {
      throw new Error("Please specify an invite code and a signature");
    }

    if (inviteCode !== undefined) {
      this.inviteCode = inviteCode;
    }

    if (signature !== undefined) {
      this.signature = signature;
    }

    return {
      getQRCode: () => {
        const stringifiedInvite = JSON.stringify({
          invite_code: inviteCode,
          aa_sig: signature
        });
        return kjua({
          text: stringifiedInvite,
          rounded: 10,
          back: "#202020",
          fill: "#2db4b4"
        }).src;
      },
      getInviteLink: () => {
        return `${config.inviteURL}/?i=${inviteCode}&aa_sig=${signature}`;
      },
      useInviteLink: () => {
        this._showPopup();
        this._popupWindow(
          `${config.inviteURL}/?i=${inviteCode}&aa_sig=${signature}`,
          "Link your account with AuthArmor",
          600,
          400
        );
      }
    };
  }

  async generateInviteCode({ nickname, referenceId }) {
    if (!nickname) {
      throw new Error("Please specify a nickname for the invite code");
    }

    const { data } = await Http.get(`/auth/autharmor/invite`, {
      nickname,
      referenceId
    });

    return {
      ...data,
      getQRCode: () => {
        const stringifiedInvite = JSON.stringify(data);
        return kjua({
          text: stringifiedInvite,
          rounded: 10,
          back: "#202020",
          fill: "#2db4b4"
        }).src;
      },
      getInviteLink: () => {
        return `${config.inviteURL}/?i=${data.invite_code}&aa_sig=${data.aa_sig}`;
      },
      useInviteLink: () => {
        this._showPopup();
        this._popupWindow(
          `${config.inviteURL}/?i=${data.invite_code}&aa_sig=${data.aa_sig}`,
          "Link your account with AuthArmor",
          600,
          400
        );
      }
    };
  }

  async confirmInvite(id) {
    this._executeEvent("authenticating");
    const { data } = await Http.get(`/auth/autharmor/invite/confirm`, {
      profileId: id
    });
    console.log(data);
  }

  // -- Authentication functionality

  async authenticate(username) {
    try {
      this._showPopup();
      const { data } = await Http.get(`/auth/autharmor/auth/request`, {
        username
      });

      if (data.response_message === "Timeout") {
        this._updateMessage("Authentication request timed out", "warn");
      }

      if (data.response_message === "Success") {
        this._updateMessage("Authentication request approved!", "warn");
      }

      if (data.response_message === "Declined") {
        this._updateMessage("Authentication request declined", "danger");
      }

      this._hidePopup();

      return data;
    } catch (err) {
      console.error(err);
      this._hidePopup();
      throw err?.response?.data;
    }
  }

  // Public interfacing SDK functions

  get invite() {
    return {
      generateInviteCode: this.generateInviteCode,
      setInviteData: this.setInviteData,
      confirmInvite: this.confirmInvite
    };
  }

  get auth() {
    return {
      authenticate: this.authenticate
    };
  }
}

export default AuthArmorSDK;
