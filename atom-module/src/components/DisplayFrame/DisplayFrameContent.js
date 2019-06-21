import * as React from 'react';
import classNames from 'classnames';
import { withStyles } from '@material-ui/core/styles';

/**
 * This dumb component creates a content container for a display frame that vertically lays out its children
 * components.
 * TODO: This component could be improved by incorporating more complex container layout functionality (using flexbox container)
 * in order to more closely resemble Java's JPanel.
 */
class DisplayFrameContent extends React.PureComponent<{
    /** CSS-in-JS styling object. */
    classes: {},

    /** React components within opening & closing tags. */
    children: React.Node,

    /** Class tags to allow additional styling of container. */
    className?: string,

    /** Direction which to lay out children. */
    orientation: 'horizontal' | 'vertical',
}> {
    static defaultProps = {
        orientation: 'vertical',
    };

    /**
     * Renders a content container with specific styling and vertical layout properties.
     */
    render() {
        const { classes, children, className, orientation } = this.props;
        return (
            <div
                className={classNames(classes.content, className)}
                style={{
                    flexDirection: orientation === 'horizontal' ? 'row' : 'column',
                }}
            >
                {children}
            </div>
        );
    }
}

// To inject styles into component
// -------------------------------

/** CSS-in-JS styling function. */
const styles = (theme) => ({
    content: {
        // Allow absolute positioning of children
        position: 'relative',

        // Layout child components vertically
        display: 'flex',

        // Content display properties
        overflow: 'auto',
        padding: theme.spacing.unit,
    },
});

export default withStyles(styles)(DisplayFrameContent);
