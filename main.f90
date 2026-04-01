program main
 integer :: n = 4
 logical :: some_bool = .true.
 integer :: k = 5
 i = 0
!  character::a = "asdnsjdjdjfdsjnfds"

 
  if (.true.) then 
    print *, "loh" 
    print *, "azaza" 
  else if (.false.) then
    k = 11  
  else if (.true.) then
    n = 6 
  else 
    i = 7
 end if
 do while (i < 10)
  print *, k ** 10
  i = i + 1
 end do
end program main