package game_fla
{
   import flash.display.MovieClip;
   import flash.events.Event;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1478")]
   public dynamic class mcZurgOn_202 extends MovieClip
   {
      
      public function mcZurgOn_202()
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

