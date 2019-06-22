from typing import Any, Dict, Union, Optional
from inspect import currentframe, getframeinfo
from types import FrameType

import vizstack
import json
import sys


def view(*args: Any):
    for arg in args:
        view_spec: str = vizstack.assemble(arg)
        frame: Optional[FrameType] = currentframe()
        assert frame is not None
        frame_info = getframeinfo(frame.f_back)
        filename, line_number = frame_info.filename, frame_info.lineno
        _send_message(filename, line_number, view_spec, False, False, sys.stdout)


def _send_message(filename: Optional[str], line_number: Optional[int], view_spec: Optional[str], script_start: bool,
                  script_end: bool, file) -> None:
    print(json.dumps({
        'filePath': filename,
        'lineNumber': line_number,
        'view': json.loads(view_spec) if view_spec is not None else None,
        'scriptStart': script_start,
        'scriptEnd': script_end,
    }), file=file)
