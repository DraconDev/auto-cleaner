# Do

-   btw there would be good to have a deeper breakdown in general settings so function like what kind? unexported, exported but unused? export and used is a safe keep for sure, similar can be said for variables
-   we need to update the clean commands they are still from the time we only did css
-   use ;
    -   when we have only one on the line we should remove the line

# Done

-   we should not only git commit but push before cleaning
-   when run a clean we seem to delete the line that is needlessly instead of the unused import so
    -   ````use crate::components::{Civilian, Enemy, Player, Police, SoulValue, Velocity};
           use crate::plugins::core::AppState;
           use crate::resources::{Director, ObjectPool, TimeManager};```
        ````
    -   so if needlessly imported then simply the line is deleted instead of the import
-   in report section if i select the square check box next to the type, in the header of the list it correctly turn all on, but itself doesn't turn on, and we have can also can't toggle off
-   make a git commit before cleaning in every setting unless turned off, but it should be on by default
    -   we didn'tdo a git commit before cleaning, in fact cleaning didn't anything seemingly, and we are still not recognizing rust
-   gitignore support is good later
-   then i see the report that rust is not even considered, i am in a rust project and apparently there is nothing to filter from rust, and i do have a lot of unused imports
    -   we are still not recognizing rust, i do have a lot of unused imports
-   select all and deselect all buttons don't work and they should
-   it would be nice to be able to collapse certain sections in the report cause the css section is long for example and scrolling past is a chore
