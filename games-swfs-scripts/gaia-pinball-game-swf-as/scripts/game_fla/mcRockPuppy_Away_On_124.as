package game_fla
{
   import flash.display.MovieClip;
   import flash.events.Event;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1188")]
   public dynamic class mcRockPuppy_Away_On_124 extends MovieClip
   {
      
      public function mcRockPuppy_Away_On_124()
      {
         super();
         addFrameScript(60,frame61);
      }
      
      internal function frame61() : *
      {
         dispatchEvent(new Event("animDone"));
         stop();
      }
   }
}

