"use strict";

class PeerVe extends Peer {
	constructor (role) {
		super();
		this._role = role;
		this._connectionsArray = [];

		this._pInit = new Promise((resolve, reject) => {
			this.on("open", id => resolve(id));
			this.on("error", e => reject(e));
		});
	}

	get connections () { return this._connectionsArray; }

	hasConnections () { return !!this._connectionsArray.length; }

	getActiveConnections () { return this._connectionsArray.filter(it => it.open); }

	pInit () { return this._pInit; }

	sendMessage (toSend) {
		if (this.disconnected || this.destroyed) throw new Error(`Connection is not active!`);

		const packet = {
			head: {
				type: this._role,
				version: "0.0.2",
			},
			data: toSend,
		};

		this.getActiveConnections().forEach(connection => connection.send(packet));
	}
}

class PeerVeServer extends PeerVe {
	constructor () {
		super("server");
		this.on("connection", conn => this._connectionsArray.push(conn));
		this._tempListeners = {};
	}

	get token () { return this.id; }

	/**
	 * Add a temporary event listener for a Peer event type.
	 */
	onTemp (eventName, listener) {
		(this._tempListeners[eventName] = this._tempListeners[eventName] || []).push(listener);
		this.on(eventName, listener);
	}

	/**
	 * Remove al temporary event listeners for a Peer event type.
	 */
	offTemp (eventName) {
		(this._tempListeners[eventName] || []).forEach(it => this.off(eventName, it));
	}
}

class PeerVeClient extends PeerVe {
	constructor () {
		super("client");
		this._data = null;
	}

	pConnectToServer (token, dataHandler, options = null) {
		const connection = options ? this.connect(token, options) : this.connect(token);

		connection.on("data", data => dataHandler(data));

		return new Promise((resolve, reject) => {
			this.on("open", id => resolve(id));
			this.on("error", e => reject(e));
		});
	}
}
