import jQuery from 'jquery'
import { ajaxurl, epDash } from 'window'

const $features = jQuery( document.getElementsByClassName( 'ep-features' ) )
const $errorOverlay = jQuery( document.getElementsByClassName( 'error-overlay' ) )
const $progressBar = jQuery( document.getElementsByClassName( 'progress-bar' ) )
const $syncStatusText = jQuery( document.getElementsByClassName( 'sync-status' ) )
const $startSyncButton = jQuery( document.getElementsByClassName( 'start-sync' ) )
const $resumeSyncButton = jQuery( document.getElementsByClassName( 'resume-sync' ) )
const $pauseSyncButton = jQuery( document.getElementsByClassName( 'pause-sync' ) )
const $cancelSyncButton = jQuery( document.getElementsByClassName( 'cancel-sync' ) )

let syncStatus = 'sync',
	featureSync = false,
	currentSyncItem,
	syncStack,
	processed = 0,
	toProcess = 0

$features.on( 'click', '.learn-more, .collapse', function() {
	jQuery( this ).parents( '.ep-feature' ).toggleClass( 'show-full' )
} )

$features.on( 'click', '.settings-button', function() {
	jQuery( this ).parents( '.ep-feature' ).toggleClass( 'show-settings' )
} )

$features.on( 'click', '.save-settings', function( event ) {
	event.preventDefault()

	if ( jQuery( this ).hasClass( 'disabled' ) ) {
		return
	}

	const feature = event.target.getAttribute( 'data-feature' )
	const $feature = $features.find( '.ep-feature-' + feature )
	const settings = {}
	const $settings = $feature.find( '.setting-field' )

	$settings.each( function() {
		const type = jQuery( this ).attr( 'type' )
		const name = jQuery( this ).attr( 'data-field-name' )
		const value = jQuery( this ).attr( 'value' )

		if ( type === 'radio' ) {
			if ( jQuery( this ).attr( 'checked' ) ) {
				settings[ name ] = value
			}
		} else {
			settings[ name ] = value
		}
	} )

	$feature.addClass( 'saving' )

	jQuery.ajax( {
		method: 'post',
		url: ajaxurl,
		data: {
			action: 'ep_save_feature',
			feature: feature,
			nonce: epDash.nonce,
			settings: settings
		}
	} ).done( ( response ) => {
		setTimeout( () => {
			$feature.removeClass( 'saving' )

			if ( settings.active === '1' ) {
				$feature.addClass( 'feature-active' )
			} else {
				$feature.removeClass( 'feature-active' )
			}

			if ( response.data.reindex ) {
				syncStatus = 'initialsync'

				updateSyncDash()

				// On initial sync, remove dashboard warnings that dont make sense
				jQuery( '[data-ep-notice="no-sync"], [data-ep-notice="auto-activate-sync"], [data-ep-notice="upgrade-sync"]' ).remove()

				syncStatus = 'sync'

				$feature.addClass( 'feature-syncing' )

				featureSync = feature

				sync()
			}
		}, 700 )
	} ).error( () => {
		setTimeout( () => {
			$feature.removeClass( 'saving' )
			$feature.removeClass( 'feature-active' )
			$feature.removeClass( 'feature-syncing' )
		}, 700 )
	} )
} )

if ( epDash.index_meta ) {
	if ( epDash.index_meta.wpcli_sync ) {
		syncStatus = 'wpcli'
		updateSyncDash()
	} else {
		processed = epDash.index_meta.offset
		toProcess = epDash.index_meta['found_items']

		if ( epDash.index_meta.feature_sync ) {
			featureSync = epDash.index_meta.feature_sync
		}

		if ( epDash.index_meta.current_sync_item ) {
			currentSyncItem = epDash.index_meta.current_sync_item
		}

		if ( epDash.index_meta.site_stack ) {
			syncStack = epDash.index_meta.sync_stack
		}

		if ( syncStack && syncStack.length ) {
			// We are mid sync
			if ( epDash.auto_start_index ) {
				syncStatus = 'sync'

				history.pushState( {}, document.title, document.location.pathname + document.location.search.replace( /&do_sync/, '' ) )

				updateSyncDash()
				sync()
			} else {
				syncStatus = 'pause'
				updateSyncDash()
			}
		} else {
			if ( toProcess === 0 && ! epDash.index_meta.start ) {
				// Sync finished
				syncStatus = 'finished'
				updateSyncDash()
			} else {
				// We are mid sync
				if ( epDash.auto_start_index ) {
					syncStatus = 'sync'

					history.pushState( {}, document.title, document.location.pathname + document.location.search.replace( /&do_sync/, '' ) )

					updateSyncDash()
					sync()
				} else {
					syncStatus = 'pause'
					updateSyncDash()
				}
			}
		}
	}
} else {
	// Start a new sync automatically
	if ( epDash.auto_start_index ) {
		syncStatus = 'initialsync'

		updateSyncDash()

		syncStatus = 'sync'

		history.pushState( {}, document.title, document.location.pathname + document.location.search.replace( /&do_sync/, '' ) )

		sync()
	}
}

function updateSyncDash() {
	let text

	if ( processed === 0 ) {
		$progressBar.css( { width: '1%' } )
	} else {
		let width = parseInt( processed ) / parseInt( toProcess ) * 100
		$progressBar.css( { width: width + '%' } )
	}

	if ( syncStatus === 'initialsync' ) {
		text = epDash.sync_initial

		$syncStatusText.text( text )

		$syncStatusText.show()
		$progressBar.show()
		$pauseSyncButton.show()
		$errorOverlay.addClass( 'syncing' )

		$cancelSyncButton.hide()
		$resumeSyncButton.hide()
		$startSyncButton.hide()
	} else if ( syncStatus === 'sync' ) {
		text = epDash.sync_syncing + ' ' + epDash.sync_indexable_labels[ currentSyncItem.indexable ].plural.toLowerCase() + ' ' + parseInt( processed ) + '/' + parseInt( toProcess )

		if ( currentSyncItem.url ) {
			text += ' (' + currentSyncItem.url + ')'
		}

		$syncStatusText.text( text )

		$syncStatusText.show()
		$progressBar.show()
		$pauseSyncButton.show()
		$errorOverlay.addClass( 'syncing' )

		$cancelSyncButton.hide()
		$resumeSyncButton.hide()
		$startSyncButton.hide()
	} else if ( syncStatus === 'pause' ) {
		text = epDash.sync_paused

		if ( toProcess && toProcess !== 0 ) {
			text += ' ' + parseInt( processed ) + '/' + parseInt( toProcess )
		}

		if ( currentSyncItem.url ) {
			text += ' (' + currentSyncItem.url + ')'
		}

		$syncStatusText.text( text )

		$syncStatusText.show()
		$progressBar.show()
		$pauseSyncButton.hide()
		$errorOverlay.addClass( 'syncing' )

		$cancelSyncButton.show()
		$resumeSyncButton.show()
		$startSyncButton.hide()
	} else if ( syncStatus === 'wpcli' ) {
		text = epDash.sync_wpcli

		$syncStatusText.text( text )

		$syncStatusText.show()
		$progressBar.hide()
		$pauseSyncButton.hide()
		$errorOverlay.addClass( 'syncing' )

		$cancelSyncButton.hide()
		$resumeSyncButton.hide()
		$startSyncButton.hide()
	} else if ( syncStatus === 'error' ) {
		$syncStatusText.text( epDash.sync_error )
		$syncStatusText.show()
		$startSyncButton.show()
		$cancelSyncButton.hide()
		$resumeSyncButton.hide()
		$pauseSyncButton.hide()
		$errorOverlay.removeClass( 'syncing' )
		$progressBar.hide()

		if ( featureSync ) {
			$features.find( '.ep-feature-' + featureSync ).removeClass( 'feature-syncing' )
		}

		featureSync = null

		setTimeout( () => {
			$syncStatusText.hide()
		}, 7000 )
	} else if ( syncStatus === 'cancel' ) {
		$syncStatusText.hide()
		$progressBar.hide()
		$pauseSyncButton.hide()
		$errorOverlay.removeClass( 'syncing' )

		$cancelSyncButton.hide()
		$resumeSyncButton.hide()
		$startSyncButton.show()

		if ( featureSync ) {
			$features.find( '.ep-feature-' + featureSync ).removeClass( 'feature-syncing' )
		}

		featureSync = null
	} else if ( syncStatus === 'finished' ) {
		$syncStatusText.text( epDash.sync_complete )

		$syncStatusText.show()
		$progressBar.hide()
		$pauseSyncButton.hide()
		$cancelSyncButton.hide()
		$resumeSyncButton.hide()
		$startSyncButton.show()
		$errorOverlay.removeClass( 'syncing' )

		if ( featureSync ) {
			$features.find( '.ep-feature-' + featureSync ).removeClass( 'feature-syncing' )
		}

		featureSync = null

		setTimeout( () => {
			$syncStatusText.hide()
		}, 7000 )
	}
}

function cancelSync() {
	jQuery.ajax( {
		method: 'post',
		url: ajaxurl,
		data: {
			action: 'ep_cancel_index',
			nonce: epDash.nonce
		}
	} )
}

function sync() {
	jQuery.ajax( {
		method: 'post',
		url: ajaxurl,
		data: {
			action: 'ep_index',
			feature_sync: featureSync,
			nonce: epDash.nonce
		}
	} ).done( ( response ) => {
		if ( syncStatus !== 'sync' ) {
			return
		}

		toProcess = response.data.found_items
		processed = response.data.offset

		if ( response.data.sync_stack ) {
			syncStack = response.data.sync_stack
		}

		if ( response.data.current_sync_item ) {
			currentSyncItem = response.data.current_sync_item
		}

		if ( syncStack && syncStack.length ) {
			// We are mid multisite sync
			syncStatus = 'sync'
			updateSyncDash()

			sync()
			return
		}

		if ( response.data.found_items === 0 && ! response.data.start ) {
			// Sync finished
			syncStatus = 'finished'
			updateSyncDash()
		} else {
			// We are starting a sync
			syncStatus = 'sync'
			updateSyncDash()

			sync()
		}
	} ).error( ( response ) => {
		if ( response && response.status && parseInt( response.status ) >= 400 && parseInt( response.status ) < 600 ) {
			syncStatus = 'error'
			updateSyncDash()

			cancelSync()
		}
	} )
}

$startSyncButton.on( 'click', () => {
	syncStatus = 'initialsync'

	updateSyncDash()

	// On initial sync, remove dashboard warnings that dont make sense
	jQuery( '[data-ep-notice="no-sync"], [data-ep-notice="auto-activate-sync"], [data-ep-notice="upgrade-sync"]' ).remove()

	syncStatus = 'sync'
	sync()
} )

$pauseSyncButton.on( 'click', () => {
	syncStatus = 'pause'

	updateSyncDash()
} )

$resumeSyncButton.on( 'click', () => {
	syncStatus = 'sync'

	updateSyncDash()

	sync()
} )

$cancelSyncButton.on( 'click', () => {
	syncStatus = 'cancel'

	updateSyncDash()

	cancelSync()
} )
