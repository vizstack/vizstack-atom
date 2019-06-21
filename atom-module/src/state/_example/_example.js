// @flow
import type { Dispatch } from 'redux';
import Immutable, { type Immutable as ImmutableType } from 'seamless-immutable';

// =================================================================================================
// State slice.

/** Root reducer's state slice type. */
export type ExampleState = ImmutableType<{
    // Description of data member.
    data: number,
}>;

/** Root reducer's initial state slice. */
const initialState: ExampleState = Immutable({
    data: 0,
});

// =================================================================================================
// Definitions (public).

/** Description of type. */
export type ExampleType = string;

// =================================================================================================
// State accessors (public).

/**
 * Get example data.
 * @param state
 * @returns Data stored in state.
 */
export function getExampleData(state: ExampleState): number {
    return state.data;
}

// =================================================================================================
// Actions (public) and reducers.

type NoOp = {| type: '' |};
type ExampleAction = Action1 | NoOp;

/**
 * Root reducer for state related to ____.
 * @param state
 * @param action
 */
export default function rootReducer(
    state: ExampleState = initialState,
    action: ExampleAction = { type: '' },
): ExampleState {
    switch (action.type) {
        case 'Action1':
            return syncReducer(state, action);
        default:
            return state; // No effect by default
    }
}

// -------------------------------------------------------------------------------------------------

type Action1 = {| type: 'Action1', value: number |};

/**
 * Description.
 * @param value
 * @returns An action object.
 */
export function syncAction(value: number): Action1 {
    // Must take form of `[name]Action`
    return {
        type: 'Action1',
        value,
    };
}

function syncReducer(state: ExampleState, action: Action1): ExampleState {
    return state.set('data', action.value);
}

// -------------------------------------------------------------------------------------------------

/**
 * Description.
 * @param value
 * @returns An action thunk.
 */
export function asyncAction(value: number) {
    return (dispatch: any, getState: () => ExampleState) => {
        let noDispatchCondition = getState().data === 0;
        if (noDispatchCondition) {
            return Promise.resolve();
        }
        return dispatch(asyncSubAction(value))
            .then(() => {
                dispatch(syncAction(value));
                dispatch(syncAction(value));
            })
            .catch((error) => console.log(error));
    };
}

function asyncSubAction(value) {
    return (dispatch) => {
        return Promise.resolve().then(dispatch(syncAction(value)));
    };
}

// import { handle } from 'redux-pack';
// function asyncReducer(state, action) {
//     return handle(state, action, {
//         start: (state) => ({ ...state }),
//         finish: (state) => ({ ...state }),
//         failure: (state) => ({ ...state }),
//         success: (state) => ({ ...state }),
//     });
// }
