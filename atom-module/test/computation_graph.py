import xnode_old
from xnode_old.computation_graph import track_callable_instance


class ChildFn:

    def __init__(self):
        self.state = 1

    def __call__(self, in1):
        return in1 + self.state


def parent_fn(in1):
    x = child_fn(in1)
    x = child_fn(x)
    x = child_fn(x)
    return x


def grandparent_fn(in1, in2):
    out1 = parent_fn(in1)
    out2 = parent_fn(in2)
    return out1 + out2


# TODO: make these annotations
child_fn = track_callable_instance(ChildFn())
# # TODO: item alignment?
parent_fn = track_callable_instance(parent_fn)
grandparent_fn = track_callable_instance(grandparent_fn)

# TODO: handle args to containers -- ignore?
x = grandparent_fn(0, 1)
graph = x.xn().compile_full()[0]
# print(graph)

xnode_old.show(x)
