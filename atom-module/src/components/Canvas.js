// @flow

import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { createSelector } from 'reselect';
import { withStyles } from '@material-ui/core/styles';
import classNames from 'classnames';

// Grid layout
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import type {
    DropResult,
    HookProvided,
    DroppableProvided,
    DraggableProvided,
} from 'react-beautiful-dnd';

// Xnode core
import { Viewer, InteractionManager, InteractionContext } from 'vizstack-core';
import type { ViewId } from 'vizstack-core';

import ViewerDisplayFrame from './ViewerDisplayFrame';
import DuplicateIcon from '@material-ui/icons/FileCopyOutlined';
import RemoveIcon from '@material-ui/icons/DeleteOutlined';

// Custom Redux actions
import { addInspectorAction, removeInspectorAction, reorderInspectorAction } from '../state/canvas';

// Miscellaneous utils
import { getCanvasLayout } from '../state/canvas';
import type { SnapshotInspector } from '../state/canvas';
import { getSnapshots } from '../state/snapshot-table';
import type { SnapshotId, Snapshot } from '../state/snapshot-table';
import { getMinimalDisambiguatedPaths } from '../utils/path-utils';

/** Component to display when loading data */
const kLoadingSpinner = <span className='loading loading-spinner-tiny inline-block' />;

type CanvasProps = {
    /** CSS-in-JS styling object. */
    classes: any,

    /** `LayoutedSnapshot` objects for rendering. */
    layoutedSnapshots: LayoutedSnapshot[],

    /**
     * See `state/canvas`.
     * @param snapshotId
     * @param insertAfterIdx?
     */
    addInspector: (snapshotId: SnapshotId, viewId?: ViewId, insertAfterIdx?: number) => void,

    /**
     * See `state/canvas`.
     * @param snapshotId
     */
    removeInspector: (snapshotId: SnapshotId) => void,

    /**
     * See `state/canvas`.
     * @param startIdx
     * @param endIdx
     */
    reorderInspector: (startIdx: number, endIdx: number) => void,

    /** The HTML DOM element which represents the "document" on which the Canvas is rendered. This
     * is passed to the `InteractionManager` so that keyboard presses can be registered. */
    documentElement?: HTMLElement,
};

type CanvasState = {};

/**
 * This smart component serves as an interactive workspace for inspecting `Snapshot`s. It
 * displays a collection of `SnapshotInspector` objects that can be moved with drag-and-drop.
 */
class Canvas extends React.Component<CanvasProps, CanvasState> {
    interactionManager: InteractionManager;
    viewerRefs = [];  // Refs to each top-level viewer, used to get viewer IDs for interaction

    static defaultProps = {
        documentElement: document,
    };

    /** Constructor. */
    constructor(props) {
        super(props);
        this.onDragEnd = this.onDragEnd.bind(this);

        const { documentElement } = props;

        this.interactionManager = new InteractionManager({documentElement});
        // Whenever "Tab" is pressed, cycle between top-level viewers
        this.interactionManager.getAllComponents()
            .subscribe('onKeyDown', (message, subscriber, state) => {
                if (message.key === 'Tab') {
                    const viewerIds = this.viewerRefs.map((ref) => ref.current.viewerId);
                    // TODO: right now, every viewer will fire this if there's nothing selected
                    let nextIdx = -1;
                    if (state.selected === subscriber.viewerId) {
                        // Find the top-level viewer the selected viewer is a descendant of
                        let currViewer = subscriber;
                        while (nextIdx === -1 && currViewer) {
                            nextIdx = viewerIds.indexOf(currViewer.viewerId);
                            currViewer = subscriber.parent;
                        }
                        // Increment one to select the next top-level viewer
                        nextIdx += 1;
                        this.interactionManager.publish({
                            eventName: 'unhighlight',
                            message: { viewerId: subscriber.viewerId, },
                        });
                    }
                    if (!state.selected || state.selected === subscriber.viewerId) {
                        if (nextIdx === -1 || nextIdx === viewerIds.length) {
                            nextIdx = 0;
                        }
                        state.selected = viewerIds[nextIdx];
                        this.interactionManager.publish({
                            eventName: 'highlight',
                            message: { viewerId: state.selected, },
                        });
                    }
                }
            });
    }

    // =================================================================================================================
    // Canvas rendering
    // =================================================================================================================

    /**
     * Function to call after a Draggable framed Viewer has been dropped in a target location.
     * @param result
     * @param provided
     */
    onDragEnd = (result: DropResult, provided: HookProvided) => {
        const { reorderInspector } = this.props;
        if (!result.destination) return;
        reorderInspector(result.source.index, result.destination.index);
    };

    /**
     * Returns a viewer of the correct type. (See `ViewerType` in `state/canvas/constants`).
     * @param viewer
     * @param idx
     */
    createFramedViewerComponent(ls: LayoutedSnapshot, idx: number) {
        const { addInspector, removeInspector } = this.props;
        const { snapshotId, viewId, snapshot } = ls;

        const buttons = [
            // TODO: Duplicate should also replicate the existing state of a viewer
            {
                title: 'Duplicate',
                icon: <DuplicateIcon />,
                onClick: () => addInspector(snapshotId, viewId, idx),
            },
            { title: 'Remove', icon: <RemoveIcon />, onClick: () => removeInspector(idx) },
        ];

        const ref = React.createRef();
        this.viewerRefs.push(ref);

        return (
            <ViewerDisplayFrame buttons={buttons}>
                {!snapshot ? kLoadingSpinner : <Viewer view={snapshot.view} viewId={viewId} ref={ref} />}
            </ViewerDisplayFrame>
        );
    }

    /**
     * Renders the inspector canvas and all viewers managed by it.
     */
    render() {
        const { classes, layoutedSnapshots } = this.props;

        // Reset the collection of Viewer refs
        this.viewerRefs = [];

        // Only render minimal disambiguated paths, and collapse consecutive identical paths.
        const fullPaths = layoutedSnapshots.map((ls: LayoutedSnapshot) => ls.snapshot.filePath);
        const fullToMinimal = getMinimalDisambiguatedPaths(fullPaths);
        let minimalPaths = [];
        for (let i = 0; i < fullPaths.length; i++) {
            minimalPaths[i] = fullPaths[i - 1] != fullPaths[i] ? fullToMinimal[fullPaths[i]] : null;
        }

        // Construct draggable viewers within frames.
        const framedViewers = layoutedSnapshots.map((ls: LayoutedSnapshot, idx: number) => {
            return (
                <Draggable key={ls.snapshotId + ls.viewId} draggableId={ls.snapshotId} index={idx}>
                    {(provided: DraggableProvided) => (
                        <div
                            ref={provided.innerRef}
                            className={classes.frameContainer}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                        >
                            <span>{minimalPaths[idx]}</span>
                            {this.createFramedViewerComponent(ls, idx)}
                        </div>
                    )}
                </Draggable>
            );
        });

        console.debug(
            `Canvas -- rendering ${layoutedSnapshots.length} viewer models`,
            layoutedSnapshots,
        );

        return (
            <InteractionContext.Provider value={this.interactionManager.getContext()}>
                <div className={classNames(classes.canvasContainer)}>
                    <DragDropContext onDragEnd={this.onDragEnd}>
                        <Droppable droppableId='canvas'>
                            {(provided: DroppableProvided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps}>
                                    {framedViewers}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </div>
            </InteractionContext.Provider>
        );
    }
}

// To inject styles into component
// -------------------------------

/** CSS-in-JS styling function. */
const styles = (theme) => ({
    canvasContainer: {
        height: '100%',
        overflow: 'auto',
        padding: theme.spacing.large,
    },
    frameContainer: {
        display: 'block',
        boxSizing: 'border-box',
    },
});

// To inject application state into component
// ------------------------------------------

export type LayoutedSnapshot = {
    snapshotId: SnapshotId,
    viewId?: ViewId,
    snapshot: Snapshot,
};

/** Connects application state objects to component props. */
function mapStateToProps() {
    return (state, props) => ({
        layoutedSnapshots: createSelector(
            (state) => getCanvasLayout(state.canvas),
            (state) => getSnapshots(state.snapshots),
            (
                layout: SnapshotInspector[],
                snapshots: { [SnapshotId]: Snapshot },
            ): LayoutedSnapshot[] => {
                return layout.map((inspector: SnapshotInspector) => {
                    return {
                        snapshotId: inspector.snapshotId,
                        viewId: inspector.viewId,
                        snapshot: snapshots[inspector.snapshotId],
                    };
                });
            },
        )(state, props), // TODO: Should not recompute every time snapshots change.
    });
}

/** Connects bound action creator functions to component props. */
function mapDispatchToProps(dispatch) {
    return bindActionCreators(
        {
            addInspector: addInspectorAction,
            removeInspector: removeInspectorAction,
            reorderInspector: reorderInspectorAction,
        },
        dispatch,
    );
}

export default connect(
    mapStateToProps,
    mapDispatchToProps,
)(withStyles(styles)(Canvas));
