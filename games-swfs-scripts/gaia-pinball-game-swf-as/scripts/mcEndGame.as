package
{
   import com.gaiaonline.games.gPinball.uiscreens.uiEndGame;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol382")]
   public dynamic class mcEndGame extends uiEndGame
   {
      
      public function mcEndGame()
      {
         super();
         addFrameScript(0,frame1,5,frame6);
      }
      
      internal function frame6() : *
      {
         trace("GUEST FRAME of endGame");
      }
      
      internal function frame1() : *
      {
         stop();
      }
   }
}

