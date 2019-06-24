import vzatom
from vizstack import Flow, Text, Switch, Grid


def my_fn(x, y=5):
    return 0


class MyClass:
    FIELD = 10
    FIELD2 = 20

    def fn(x, y, z=5):
        return 0

    def __view__(self):
        return Flow(
            [
                Text(
                    'Contrary to popular belief, Lorem Ipsum is not simply random text. It has '
                    'roots in a piece of classical Latin literature from 45 BC, making it over '
                    '2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney '
                    'College in Virginia, looked up one of the more obscure Latin words, '
                    'consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of "de Finibus Bonorum et Malorum" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, "Lorem ipsum dolor sit amet..", comes from a line in section 1.10.32.'
                ), [10, 20, 30], [40, 50, 60], Text('and on and on and on and on and on and on')
            ]
        )


vzatom.view(MyClass())

b = {}
a = {'x': b, 'y': {'d': 'b'}}
b['y'] = a

vzatom.view(b)

vzatom.view(vzatom)

vzatom.view(my_fn)

l = [10, 2, 3, 2341, 2134, 2134, 213, 2134]
vzatom.view(l)

g = Grid(items={'A': 'hello', 'B': 'world'})
g.cell('A', 0, 0, 1, 1)
g.cell('B', 1, 1, 1, 1)
vzatom.view(g)
