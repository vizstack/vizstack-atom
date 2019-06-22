import pdb
import os
import argparse
from os.path import normpath, normcase
from types import FrameType
from typing import Callable, Mapping, Union, Any, Optional, List, Tuple


# Taken from atom-python-debugger
class _ScriptExecutor(pdb.Pdb):  # type: ignore
    """Runs a given Python script within the same process.

    The `_ScriptExecutor` is a modified `Pdb` instance, using the `Pdb._runscript()` function to execute given
    scripts within the `_ScriptExecutor`'s process so that values can be read from it and sent to clients.
    """

    def __init__(self, **kwargs) -> None:
        pdb.Pdb.__init__(self, **kwargs)  # type: ignore

    # ==================================================================================================================
    # Public methods.
    # ==================================================================================================================

    def execute(self, script_path: str, script_args: List[str]) -> None:
        """Execute a script within the `_ScriptExecutor` instance, allowing its flow to be controlled by the instance.

        `_execute()` should be called only once per `_ScriptExecutor` instance, as its behavior is unknown after
        multiple runs.

        Args:
            script_path: The absolute path to the user-written script to be executed.
            script_args: Arguments that should be passed to the executed script.
        """
        # We have to re-import `sys` here, since it has not yet been imported in this scope
        import sys
        normalized_path = _ScriptExecutor._normalize_path(script_path)
        sys.argv = [normalized_path] + script_args
        sys.path.append(os.path.dirname(normalized_path))
        os.chdir(os.path.dirname(normalized_path))
        self._runscript(normalized_path)

    # ==================================================================================================================
    # `pdb` overrides.
    # ----------------
    # `pdb` calls these functions at various points during the execution of a script; we perform no special behavior
    # at any of them, allowing the script's execution to continue normally.
    # ==================================================================================================================

    def user_line(self, frame: FrameType) -> None:
        pass

    def user_return(self, frame: FrameType, return_value: Any) -> None:
        pass

    # `message` and `error` are called by `Pdb` to write to the respective streams. We block those messages so that
    # only object info will be sent to stdout, and thus read by the engine.
    def message(self, msg: str) -> None:
        pass

    def error(self, msg: str) -> None:
        pass

    # These are overrides that were included in `atom-python-debugger`; TODO: investigate their purpose.
    def precmd(self, line):
        return line

    def postcmd(self, stop, line):
        return stop

    # ==================================================================================================================
    # Static helper methods.
    # ----------------------
    # Functions which are used to transform incoming messages to a usable format.
    # ==================================================================================================================

    @staticmethod
    def _normalize_path(file_path: str) -> str:
        """Normalizes a file path so it can be safely executed.

        Args:
            file_path: A string file path.

        Returns:
            The normalized file path.
        """
        return normcase(normpath(file_path))


class _PrintOverwriter:
    """
    An object to be used as a replacement for stdout, which uses a given function to send printed strings to the client.
    """

    def __init__(self) -> None:
        self._unprinted_text: str = ''

    def write(self, text: str) -> None:
        # These all need to be imported directly into this scope
        import vizstack
        import visual_debugger
        import sys
        import json
        from inspect import currentframe, getframeinfo
        try:
            message = json.loads(text.strip())
            assert 'filePath' in message
            assert 'lineNumber' in message
            assert 'view' in message
            assert 'scriptStart' in message
            assert 'scriptEnd' in message
            print(text, file=sys.__stdout__)
        except (json.decoder.JSONDecodeError, AssertionError):
            self._unprinted_text += text
            if self._unprinted_text.endswith('\n') and len(self._unprinted_text.strip()) > 0:
                # If we just call visual_debugger.view(), the stack has one too many frames and the View won't appear to
                # have come from the correct file
                view_spec: str = vizstack.assemble(self._unprinted_text.strip())
                frame: Optional[FrameType] = currentframe()
                assert frame is not None
                frame_info = getframeinfo(frame.f_back)
                filename, line_number = frame_info.filename, frame_info.lineno
                visual_debugger._send_message(filename, line_number, view_spec, False, False, sys.__stdout__)
                self._unprinted_text = ''

    def flush(self) -> None:
        pass


# ======================================================================================================================
# Public methods.
# ---------------
# Methods to be called by clients that want to run a Python script and receive schema representations of objects in
# its namespace.
# ======================================================================================================================

def _read_args() -> Tuple[List[str], List[str]]:
    """Read the path to the user-written script which should be executed by the engine from the command line.

    Returns:
        Absolute path to the script to be executed.
    """
    parser: argparse.ArgumentParser = argparse.ArgumentParser()
    parser.add_argument('--scriptPaths', type=str, nargs='+')
    parser.add_argument('--scriptArgs', type=str, nargs='*')
    args = parser.parse_args()
    return args.scriptPaths, args.scriptArgs


def _main() -> None:
    """Runs a given script, writing the vizzes of watched objects to a queue and then writing the vizzes of
    additional variables requested by a client to another queue.

    The given script is executed to completion; afterwards, viz IDs are read on a loop from `receive_queue`.
    The viz entries for these objects, as well as the entries of vizzes they reference, are written as JSON strings
    to `send_queue`.

    Should be called as the main function of a new process.

    Args:
        receive_queue: A queue shared with the calling process to which requests for new viz models are written by
            the parent.
        send_queue: A queue shared with the calling process to which this process writes messages.
        script_path: The absolute path to a user-written script to be executed.
        script_args: Arguments that should be passed to the executed script.
    """
    # Wait for the parent process to tell this process to start
    input()

    # For some reason, these have to be imported in this scope, not in the global scope. TODO figure out why
    import sys
    import visual_debugger

    # Replace stdout with an object that queues all statements printed by the user script as messages
    sys.stdout = _PrintOverwriter()  # type: ignore

    executor: _ScriptExecutor = _ScriptExecutor()

    script_paths, script_args = _read_args()
    script_path: Optional[str] = None
    for script_path in script_paths:
        if os.path.isfile(script_path):
            break
    assert script_path is not None

    try:
        visual_debugger._send_message(None, None, None, True, False, sys.__stdout__)
        executor.execute(script_path, script_args)
        # Indicate to the client that the script has finished executing
        visual_debugger._send_message(None, None, None, False, True, sys.__stdout__)
    except:
        # Import all of these, since they might have been removed when running the user's script
        import traceback
        import visual_debugger
        import vizstack
        import re
        from vizstack.view import Text
        raw_error_msg: str = traceback.format_exc()
        try:
            result = re.search(
                r"^(Traceback.*?:\n)(.*File \"<string>\", line 1, in <module>\s)(.*)$",
                raw_error_msg, re.DOTALL
            )
            assert result is not None
            clean_error_msg: str = result.group(1) + result.group(3)
            result = re.search(
                r"^Traceback \(most recent call last\):\s*File \"(.*)\", line (\d*),?(.*)$",
                clean_error_msg, re.DOTALL
            )
            assert result is not None
            visual_debugger._send_message(result.group(1), int(result.group(2)), vizstack.assemble(
                Text(clean_error_msg, 'error', 'token')
            ), False, True, sys.__stdout__)
        except:
            try:
                # if something goes wrong in parsing the traceback, write it directly
                visual_debugger._send_message('engine.py', 0, vizstack.assemble(
                    Text(raw_error_msg, 'error', 'token')
                ), False, True, sys.__stdout__)
            except:
                # if something goes terribly wrong, just print it and hope for the best
                print(raw_error_msg)


if __name__ == '__main__':
    _main()
