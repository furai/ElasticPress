<?php
/**
 * Class responsible for rendering the block.
 *
 * @since 4.5.0
 * @package elasticpress
 */

namespace ElasticPress\Feature\Facets\Types\MetaRange;

use ElasticPress\Features as Features;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Facets render class
 */
class Renderer {
	/**
	 * Holds the meta field selected.
	 *
	 * @var string
	 */
	protected $meta_field = '';

	/**
	 * Output the widget or block HTML.
	 *
	 * @param array $args     Widget args
	 * @param array $instance Instance settings
	 */
	public function render( $args, $instance ) {
		$this->meta_field = $instance['facet'];
		if ( empty( $this->meta_field ) ) {
			if ( $instance['is_preview'] ) {
				esc_html_e( 'Preview not available. Make sure you select a field.', 'elasticpress' );
			}
			return false;
		}

		if ( ! $this->should_render() ) {
			return;
		}

		$feature    = Features::factory()->get_registered_feature( 'facets' );
		$facet_type = $feature->types['meta-range'];

		$min_field_name = $facet_type->get_filter_name() . $this->meta_field . '_min';
		$max_field_name = $facet_type->get_filter_name() . $this->meta_field . '_max';

		if ( empty( $GLOBALS['ep_facet_aggs'][ $min_field_name ] )
			|| empty( $GLOBALS['ep_facet_aggs'][ $max_field_name ] )
		) {
			if ( $instance['is_preview'] ) {
				esc_html_e( 'Could not get min and max values. Is this a numeric field?', 'elasticpress' );
			}
			return false;
		}

		$min = $GLOBALS['ep_facet_aggs'][ $min_field_name ];
		$max = $GLOBALS['ep_facet_aggs'][ $max_field_name ];

		$selected_min_value = null;
		$selected_max_value = null;

		$selected_filters = $feature->get_selected();
		foreach ( $selected_filters[ $facet_type->get_filter_type() ] as $filter => $values ) {
			if ( $this->meta_field !== $filter ) {
				continue;
			}

			$selected_min_value = $values['_min'] ?? null;
			$selected_max_value = $values['_max'] ?? null;
			unset( $selected_filters[ $facet_type->get_filter_type() ][ $filter ] );
		}
		$form_action = wp_parse_url( $feature->build_query_url( $selected_filters ) );
		wp_parse_str( $form_action['query'] ?? '', $filter_fields );
		?>
		<form class="ep-facet-meta-range">
			<input type="hidden" name="<?php echo esc_attr( $min_field_name ); ?>" min="<?php echo absint( $min ); ?>" max="<?php echo absint( $max ); ?>" value="<?php echo esc_attr( $selected_min_value ); ?>">
			<input type="hidden" name="<?php echo esc_attr( $max_field_name ); ?>" min="<?php echo absint( $min ); ?>" max="<?php echo absint( $max ); ?>" value="<?php echo esc_attr( $selected_max_value ); ?>">

			<?php foreach ( $filter_fields as $field => $value ) { ?>
				<input type="hidden" name="<?php echo esc_attr( $field ); ?>" value="<?php echo esc_attr( $value ); ?>">
			<?php } ?>
		</form>
		<?php
	}

	/**
	 * Determine if the block/widget should or not be rendered.
	 *
	 * @return boolean
	 */
	protected function should_render() : bool {
		global $wp_query;

		$feature = Features::factory()->get_registered_feature( 'facets' );
		if ( $wp_query->get( 'ep_facet', false ) && ! $feature->is_facetable( $wp_query ) ) {
			return false;
		}

		$es_success = ( ! empty( $wp_query->elasticsearch_success ) ) ? true : false;
		if ( ! $es_success ) {
			return false;
		}

		return true;
	}
}
